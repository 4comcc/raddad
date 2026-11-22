import "server-only";
import type { Business } from "@/db/schema";

/** Minimal WooCommerce REST API (v3) client used by the assistant's store tools. */

export type WooCreds = { url: string; key: string; secret: string };

export function wooCreds(b: Pick<Business, "wooUrl" | "wooConsumerKey" | "wooConsumerSecret">): WooCreds | null {
  if (!b.wooUrl || !b.wooConsumerKey || !b.wooConsumerSecret) return null;
  return { url: normalizeStoreUrl(b.wooUrl), key: b.wooConsumerKey, secret: b.wooConsumerSecret };
}

export function normalizeStoreUrl(u: string) {
  let url = u.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

class WooError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function wooGet<T>(c: WooCreds, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const u = new URL(`${c.url}/wp-json/wc/v3${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const auth = "Basic " + Buffer.from(`${c.key}:${c.secret}`).toString("base64");
  let res = await fetch(u, { headers: { Authorization: auth, Accept: "application/json" }, cache: "no-store" });
  // Some hosts strip the Authorization header — retry with query-string auth (HTTPS only).
  if (res.status === 401 && u.protocol === "https:") {
    u.searchParams.set("consumer_key", c.key);
    u.searchParams.set("consumer_secret", c.secret);
    res = await fetch(u, { headers: { Accept: "application/json" }, cache: "no-store" });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new WooError(body.message || `WooCommerce HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

const stripHtml = (s = "") =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();

const digits = (s = "") => s.replace(/\D/g, "");

/** Same phone if the last 9 digits match (ignores country code / leading zero formatting). */
export function samePhone(a: string, b: string) {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 8 && y.length >= 8 && x.slice(-9) === y.slice(-9);
}

// ---------- Products ----------
type WooProduct = {
  id: number;
  name: string;
  permalink: string;
  type: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  short_description: string;
  description: string;
  categories: { name: string }[];
  attributes: { name: string; options: string[]; variation?: boolean }[];
  images: { src: string }[];
};

type WooVariation = {
  id: number;
  price: string;
  stock_status: string;
  stock_quantity: number | null;
  attributes: { name: string; option: string }[];
};

export async function searchProducts(c: WooCreds, query: string, limit = 5) {
  const products = await wooGet<WooProduct[]>(c, "/products", {
    search: query.slice(0, 100),
    per_page: Math.min(limit, 8),
    status: "publish",
  });

  // For variable products, fetch which variations are in stock (top 3 only, to keep it fast).
  const variationInfo = new Map<number, string[]>();
  await Promise.all(
    products
      .filter((p) => p.type === "variable")
      .slice(0, 3)
      .map(async (p) => {
        try {
          const vars = await wooGet<WooVariation[]>(c, `/products/${p.id}/variations`, { per_page: 50 });
          variationInfo.set(
            p.id,
            vars.map(
              (v) =>
                `${v.attributes.map((a) => a.option).join(" / ")}: ${v.price} — ${
                  v.stock_status === "instock" ? "متوفر" : "غير متوفر"
                }`,
            ),
          );
        } catch {
          /* ignore */
        }
      }),
  );

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    regular_price: p.regular_price || undefined,
    on_sale: p.on_sale || undefined,
    stock: p.stock_status === "instock" ? "متوفر" : p.stock_status === "onbackorder" ? "بالطلب المسبق" : "غير متوفر",
    stock_quantity: p.stock_quantity ?? undefined,
    categories: p.categories.map((x) => x.name).join("، ") || undefined,
    options: p.attributes.length
      ? p.attributes.map((a) => `${a.name}: ${a.options.join("، ")}`).join(" | ")
      : undefined,
    variations: variationInfo.get(p.id),
    description: stripHtml(p.short_description || p.description).slice(0, 300) || undefined,
    link: p.permalink,
    image: p.images[0]?.src,
  }));
}

// ---------- Orders ----------
type WooOrder = {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  date_created: string;
  payment_method_title: string;
  billing: { first_name: string; phone: string; email: string };
  shipping: { city: string; address_1: string };
  line_items: { name: string; quantity: number; total: string }[];
  shipping_lines: { method_title: string }[];
  customer_note: string;
  meta_data?: { key: string; value: unknown }[];
};

const STATUS_AR: Record<string, string> = {
  pending: "بانتظار الدفع",
  processing: "قيد التجهيز",
  "on-hold": "معلّق (بانتظار التأكيد)",
  completed: "مكتمل / تم التسليم",
  cancelled: "ملغي",
  refunded: "مسترجع",
  failed: "فشل الدفع",
  "checkout-draft": "مسودة",
  shipped: "تم الشحن",
};

function summarizeOrder(o: WooOrder) {
  // Common tracking plugins store the number in order meta.
  const tracking = o.meta_data?.find((m) =>
    ["_tracking_number", "_wc_shipment_tracking_items", "tracking_number", "_aftership_tracking_number"].includes(m.key),
  );
  let trackingText: string | undefined;
  if (tracking) {
    const v = tracking.value;
    if (typeof v === "string") trackingText = v;
    else if (Array.isArray(v) && v[0] && typeof v[0] === "object") {
      const t = v[0] as { tracking_number?: string; tracking_provider?: string };
      trackingText = [t.tracking_provider, t.tracking_number].filter(Boolean).join(" ");
    }
  }
  return {
    order_number: o.number,
    status: STATUS_AR[o.status] ?? o.status,
    date: o.date_created?.slice(0, 10),
    total: `${o.total} ${o.currency}`,
    items: o.line_items.map((i) => `${i.name} × ${i.quantity}`),
    payment: o.payment_method_title || undefined,
    shipping_method: o.shipping_lines[0]?.method_title,
    city: o.shipping.city || undefined,
    tracking: trackingText,
  };
}

/**
 * Look up one order. Only returns details if the order's billing phone matches the
 * customer's WhatsApp number, or the customer supplied the matching billing email.
 */
export async function getOrderForCustomer(
  c: WooCreds,
  opts: { orderNumber: string; customerPhone: string; email?: string; skipVerification?: boolean },
) {
  const id = digits(opts.orderNumber);
  if (!id) return { error: "رقم الطلب غير صالح" };
  let order: WooOrder;
  try {
    order = await wooGet<WooOrder>(c, `/orders/${id}`);
  } catch (e) {
    if (e instanceof WooError && e.status === 404) return { error: "لم يتم العثور على طلب بهذا الرقم" };
    throw e;
  }
  const verified =
    opts.skipVerification ||
    samePhone(order.billing.phone, opts.customerPhone) ||
    (opts.email && order.billing.email && opts.email.trim().toLowerCase() === order.billing.email.toLowerCase());
  if (!verified) {
    return {
      verification_required: true,
      note: "رقم واتساب العميل لا يطابق رقم الطلب. اطلب منه البريد الإلكتروني المستخدم في الطلب، ثم أعد المحاولة مع email. لا تكشف أي تفاصيل عن الطلب قبل التحقق.",
    };
  }
  return { order: summarizeOrder(order) };
}

/** Recent orders whose billing phone matches the customer's WhatsApp number. */
export async function recentOrdersForPhone(c: WooCreds, customerPhone: string) {
  const last = digits(customerPhone).slice(-9);
  if (last.length < 8) return { orders: [] };
  const orders = await wooGet<WooOrder[]>(c, "/orders", { search: last, per_page: 10, orderby: "date", order: "desc" });
  return {
    orders: orders
      .filter((o) => samePhone(o.billing.phone, customerPhone))
      .slice(0, 3)
      .map(summarizeOrder),
  };
}

export async function testConnection(c: WooCreds) {
  const products = await wooGet<WooProduct[]>(c, "/products", { per_page: 1, status: "publish" });
  let ordersOk = true;
  try {
    await wooGet<WooOrder[]>(c, "/orders", { per_page: 1 });
  } catch {
    ordersOk = false;
  }
  return { productsOk: true, sampleProduct: products[0]?.name, ordersOk };
}
