import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes, type Business } from "@/db/schema";
import { getProduct, wooCreds } from "@/lib/woocommerce";
import { renderQuotePdf } from "./pdf";
import { renderQuoteXlsx } from "./xlsx";
import { computeTotals, round2, type QuoteData, type QuoteItem } from "./types";

export type QuoteRequestItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  product_id?: number;
  image_url?: string;
  note?: string;
};

export function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function quoteUrl(id: string, token: string, number: number, format: string) {
  return `${appBaseUrl()}/api/quotes/${id}/${token}/quote-${number}.${format}`;
}

/**
 * Build and store a quote. Line totals and grand total are always computed here, never by the model;
 * with WooCommerce connected, items carrying a product_id get the store's current name and price.
 */
export async function createQuote(opts: {
  business: Business;
  conversationId?: string;
  customerPhone?: string;
  customerName?: string;
  format: "pdf" | "xlsx";
  items: QuoteRequestItem[];
  notes?: string;
  allowedImages: Set<string>;
}) {
  const b = opts.business;
  const woo = wooCreds(b);
  const items: QuoteItem[] = [];
  const problems: string[] = [];

  for (const raw of opts.items.slice(0, 50)) {
    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      problems.push(`كمية غير صالحة للصنف: ${raw.name ?? "?"}`);
      continue;
    }
    let name = (raw.name ?? "").trim();
    let unitPrice = Number(raw.unit_price);
    let imageUrl = raw.image_url && opts.allowedImages.has(raw.image_url) ? raw.image_url : undefined;
    if (woo && raw.product_id) {
      const p = await getProduct(woo, Number(raw.product_id));
      if (p) {
        name = name || p.name;
        unitPrice = p.price;
        imageUrl = imageUrl ?? p.image;
      }
    }
    if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) {
      problems.push(`سعر أو اسم غير صالح للصنف: ${name || "?"}`);
      continue;
    }
    items.push({ name: name.slice(0, 200), quantity, unitPrice: round2(unitPrice), imageUrl, note: raw.note?.slice(0, 200) });
  }
  if (!items.length) return { error: problems.join("؛ ") || "لا توجد أصناف صالحة" };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${quotes.number}), 1000) + 1` })
    .from(quotes)
    .where(eq(quotes.businessId, b.id));

  const data: QuoteData = {
    number: Number(next),
    date: new Date(),
    validDays: b.quoteValidDays || 7,
    business: { name: b.name, contact: b.location || undefined },
    customer: { name: opts.customerName, phone: opts.customerPhone },
    currency: b.quoteCurrency || "",
    taxRate: b.quoteTaxRate || 0,
    items,
    notes: opts.notes?.slice(0, 1000),
    terms: b.quoteTerms || b.policies || undefined,
  };
  const file = opts.format === "xlsx" ? await renderQuoteXlsx(data) : await renderQuotePdf(data);
  const totals = computeTotals(items, data.taxRate);
  const token = randomBytes(18).toString("base64url");

  const [row] = await db
    .insert(quotes)
    .values({
      businessId: b.id,
      conversationId: opts.conversationId,
      number: data.number,
      token,
      format: opts.format,
      customerName: opts.customerName,
      data: { ...data, date: data.date.toISOString() },
      total: totals.total,
      currency: data.currency,
      file,
    })
    .returning({ id: quotes.id });

  return {
    quote: {
      id: row.id,
      number: data.number,
      format: opts.format,
      fileName: `عرض-سعر-${data.number}.${opts.format}`,
      url: quoteUrl(row.id, token, data.number, opts.format),
      ...totals,
      currency: data.currency,
      items: items.map((i) => `${i.name} × ${i.quantity} @ ${i.unitPrice}`),
    },
    warnings: problems.length ? problems : undefined,
  };
}

export async function getQuoteFile(id: string, token: string) {
  const [q] = await db
    .select({ file: quotes.file, format: quotes.format, number: quotes.number, token: quotes.token })
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  if (!q) return null;
  const a = Buffer.from(q.token);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? q : null;
}
