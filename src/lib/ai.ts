import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Business, Message } from "@/db/schema";
import { getOrderForCustomer, recentOrdersForPhone, searchProducts, wooCreds, type WooCreds } from "@/lib/woocommerce";
import { createQuote, type QuoteRequestItem } from "@/lib/quotes";

export type AiResult = {
  reply: string;
  handoff: boolean;
  handoffReason?: string;
  lead?: { kind: "ORDER" | "BOOKING" | "INQUIRY"; details: string };
  customerName?: string;
  images?: { url: string; caption?: string }[];
  documents?: { url: string; fileName: string; caption?: string }[];
  quoteSummary?: string;
};

export type ReplyContext = {
  customerPhone: string;
  isSimulator: boolean;
  conversationId?: string;
  customerName?: string | null;
};

const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond",
  description:
    "Send the final reply to the customer on WhatsApp. Optionally attach product images, record an order/booking, or hand off to a human. Call this exactly once, at the end.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description: "The WhatsApp message to send to the customer. Short, natural, in the customer's language/dialect.",
      },
      handoff: {
        type: "boolean",
        description:
          "true if a human staff member must take over: complaint, angry customer, explicit request for a human, or a question the business info/tools cannot answer and that matters for a sale.",
      },
      handoff_reason: { type: "string", description: "Short reason for the staff (Arabic)." },
      lead: {
        type: "object",
        description:
          "Fill ONLY when the customer has confirmed a complete order or booking request (all required details collected) in THIS turn.",
        properties: {
          kind: { type: "string", enum: ["ORDER", "BOOKING", "INQUIRY"] },
          details: {
            type: "string",
            description: "Full summary for the staff in Arabic: items/service, quantities, date/time, name, address, total, etc.",
          },
        },
        required: ["kind", "details"],
      },
      images: {
        type: "array",
        maxItems: 3,
        description:
          "Product images to send after the text (only image URLs returned by search_products or written in the business catalog). Use when the customer asks to see a product or is choosing between products.",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            caption: { type: "string", description: "Product name, price and link." },
          },
          required: ["url"],
        },
      },
      customer_name: { type: "string", description: "Customer's name if they mentioned it." },
    },
    required: ["reply", "handoff"],
  },
};

const STORE_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search the online store's live catalog. Returns name, price, stock, options/sizes, variations with stock, link and image. Use for ANY question about products, prices, availability, sizes or colors. Search with short keywords (try Arabic and English names if the first search returns nothing).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Short search keywords, e.g. 'هودي' or 'hoodie'." } },
      required: ["query"],
    },
  },
  {
    name: "get_order",
    description:
      "Get the status of a specific order by its order number. The order is only shown if it belongs to this customer (verified by WhatsApp number, or by the billing email if the customer gives it).",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        email: { type: "string", description: "Billing email, only if the customer provided it for verification." },
      },
      required: ["order_number"],
    },
  },
  {
    name: "my_recent_orders",
    description:
      "List the customer's most recent orders (matched by their WhatsApp number). Use when they ask about 'my order' without giving a number.",
    input_schema: { type: "object", properties: {} },
  },
];

const QUOTE_TOOL: Anthropic.Tool = {
  name: "create_quote",
  description:
    "Create a formal price quote (عرض سعر) as a PDF or Excel file and attach it to the WhatsApp reply. Totals and tax are calculated automatically. Use only prices from the catalog or search_products results.",
  input_schema: {
    type: "object",
    properties: {
      format: { type: "string", enum: ["pdf", "xlsx"], description: "pdf (default) or xlsx for Excel." },
      customer_name: { type: "string" },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Product/service name as shown to the customer, including size/color." },
            quantity: { type: "number" },
            unit_price: { type: "number", description: "Price per unit before tax, from the catalog or search results." },
            product_id: { type: "number", description: "WooCommerce product id from search_products (price is then verified from the store)." },
            image_url: { type: "string", description: "Product image URL from search results or the catalog, to show in the quote." },
            note: { type: "string", description: "Optional short detail, e.g. size or color." },
          },
          required: ["name", "quantity", "unit_price"],
        },
      },
      notes: { type: "string", description: "Optional notes for this quote (delivery, special conditions)." },
    },
    required: ["format", "items"],
  },
};

const IMAGE_URL_RE = /https:\/\/[^\s"'<>]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]*)?/gi;

export function buildSystemPrompt(b: Business, hasStore = false) {
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}\n` : "");
  const storeRules = hasStore
    ? `
قواعد المتجر الإلكتروني (لديك أدوات متصلة بالمتجر مباشرة):
- لأي سؤال عن منتج أو سعر أو توفر أو مقاس أو لون: استخدم search_products أولًا، ولا تعتمد على الذاكرة. الأسعار والمخزون من الأداة هي الصحيحة.
- اذكر السعر والتوفر بوضوح، وأرسل رابط المنتج ليطلب منه العميل. إذا طلب رؤية المنتج أو كان يقارن، أرفق صورته في images.
- إذا لم تجد المنتج: جرّب كلمة أخرى (عربي/إنجليزي/مرادف)، ثم اقترح أقرب بديل متوفر.
- لحالة الطلب: إذا أعطى رقم الطلب استخدم get_order، وإلا استخدم my_recent_orders. لا تكشف تفاصيل طلب لم يتم التحقق من صاحبه.
- إن أراد الطلب عبر واتساب بدل الموقع: اجمع المنتج والمقاس والكمية والاسم والعنوان والهاتف، ثم لخّص واطلب التأكيد وسجّله في lead.
`
    : "";
  const quoteRules = b.quotesEnabled
    ? `
عروض الأسعار (لديك الأداة create_quote):
- إذا طلب العميل عرض سعر أو فاتورة مبدئية أو تسعيرة لعدة أصناف: تأكد من الأصناف والكميات${hasStore ? " وابحث عن الأسعار بـ search_products" : ""}، واسأله عن اسمه إن لم تعرفه، وعن الصيغة (PDF أو Excel) إن لم يحددها — الافتراضي PDF.
- ثم استدعِ create_quote بالأسعار الصحيحة فقط${hasStore ? " ومعها product_id و image_url من نتائج البحث" : ""}. لا تحسب الإجمالي بنفسك؛ الأداة تحسبه.
- بعد إنشائه أرسل رسالة قصيرة: أن العرض مرفق، رقمه، والإجمالي كما أعادته الأداة.
`
    : "";
  const catalogImages = (b.catalog.match(IMAGE_URL_RE) ?? []).length
    ? "\n- في قائمة المنتجات روابط صور؛ إذا طلب العميل رؤية منتج أرفق رابط صورته في images.\n"
    : "";
  return `أنت موظف خدمة العملاء على واتساب لنشاط "${b.name}". تتحدث باسم النشاط كأنك أحد موظفيه.

قواعد أساسية:
- رد بلغة العميل ولهجته (عربي بأي لهجة، أو إنجليزي، أو غيره).
- الأسلوب: ${b.tone || "ودود ومختصر"}. رسائل واتساب قصيرة (1–5 أسطر غالبًا)، بدون عناوين أو تنسيق Markdown.
- اعتمد فقط على معلومات النشاط أدناه${hasStore ? " ونتائج أدوات المتجر" : ""}. لا تخترع أسعارًا أو منتجات أو مواعيد أو سياسات.
- إذا سُئلت عن شيء لا تجده: قل بلطف إنك ستتأكد من الزملاء، واجعل handoff = true.
- عند طلب أو حجز: اجمع التفاصيل الناقصة سؤالًا بسؤال، ثم لخّص الطلب واطلب تأكيد العميل. بعد التأكيد فقط سجّل lead.
- إذا اشتكى العميل أو غضب أو طلب التحدث مع إنسان: اعتذر بلطف وأخبره أن زميلًا سيتواصل معه قريبًا، واجعل handoff = true.
- لا تذكر أنك ذكاء اصطناعي إلا إذا سُئلت مباشرة؛ وإن سُئلت فكن صادقًا وقل إنك مساعد آلي للنشاط.
- أنهِ كل دور باستدعاء الأداة respond مرة واحدة لإرسال ردك.
${storeRules}${quoteRules}${catalogImages}
# معلومات النشاط
${section("نبذة", b.description)}${section("مواعيد العمل", b.hours)}${section("العنوان / الفروع / رابط المتجر", b.location)}${section("المنتجات والخدمات والأسعار", b.catalog)}${section("أسئلة شائعة", b.faqs)}${section("السياسات", b.policies)}${section("تعليمات خاصة", b.extraInstructions)}`;
}

function toApiMessages(history: Pick<Message, "role" | "text">[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.role === "SYSTEM") continue;
    const role = m.role === "CUSTOMER" ? "user" : "assistant";
    const text = m.role === "AGENT" ? `[رد من موظف]: ${m.text}` : m.text;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n${text}`;
    else out.push({ role, content: text });
  }
  // API requires the first message to be from the user
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type ToolEnv = {
  b: Business;
  woo: WooCreds | null;
  ctx: ReplyContext;
  allowedImages: Set<string>;
  documents: NonNullable<AiResult["documents"]>;
  quoteSummaries: string[];
};

async function runTool(name: string, input: Record<string, unknown>, env: ToolEnv) {
  const { woo, ctx } = env;
  try {
    if (name === "create_quote") {
      const r = await createQuote({
        business: env.b,
        conversationId: ctx.conversationId,
        customerPhone: ctx.customerPhone,
        customerName: (input.customer_name as string) || ctx.customerName || undefined,
        format: input.format === "xlsx" ? "xlsx" : "pdf",
        items: (input.items as QuoteRequestItem[]) ?? [],
        notes: input.notes as string | undefined,
        allowedImages: env.allowedImages,
      });
      if ("quote" in r && r.quote) {
        const q = r.quote;
        env.documents.push({ url: q.url, fileName: q.fileName, caption: `عرض سعر رقم ${q.number}` });
        env.quoteSummaries.push(
          `عرض سعر #${q.number} (${q.format.toUpperCase()}) — الإجمالي ${q.total} ${q.currency}\n${q.items.join("\n")}\n${q.url}`,
        );
        const { url: _url, id: _id, ...forModel } = q;
        void _url;
        void _id;
        return { created: true, ...forModel, warnings: r.warnings };
      }
      return r;
    }
    if (!woo) return { error: "المتجر غير مربوط" };
    switch (name) {
      case "search_products":
        return { products: await searchProducts(woo, String(input.query ?? ""), 5) };
      case "get_order":
        return await getOrderForCustomer(woo, {
          orderNumber: String(input.order_number ?? ""),
          email: input.email ? String(input.email) : undefined,
          customerPhone: ctx.customerPhone,
          skipVerification: ctx.isSimulator, // dashboard testing only
        });
      case "my_recent_orders":
        if (ctx.isSimulator) return { orders: [], note: "المحاكي ليس له رقم واتساب حقيقي — اطلب رقم الطلب بدلًا من ذلك." };
        return await recentOrdersForPhone(woo, ctx.customerPhone);
      default:
        return { error: `Unknown tool ${name}` };
    }
  } catch (e) {
    return { error: `تعذر الوصول للمتجر: ${(e as Error).message}`.slice(0, 300) };
  }
}

function parseRespond(input: Record<string, unknown>): AiResult {
  const i = input as {
    reply?: string;
    handoff?: boolean;
    handoff_reason?: string;
    lead?: AiResult["lead"];
    customer_name?: string;
    images?: { url?: string; caption?: string }[];
  };
  return {
    reply: (i.reply ?? "").trim(),
    handoff: Boolean(i.handoff),
    handoffReason: i.handoff_reason,
    lead: i.lead?.details ? i.lead : undefined,
    customerName: i.customer_name,
    images: (i.images ?? [])
      .filter((x): x is { url: string; caption?: string } => typeof x?.url === "string" && /^https:\/\//.test(x.url))
      .slice(0, 3),
  };
}

const MAX_TOOL_ROUNDS = 5;

export async function generateReply(
  b: Business,
  history: Pick<Message, "role" | "text">[],
  ctx: ReplyContext = { customerPhone: "", isSimulator: false },
): Promise<AiResult> {
  if (!aiConfigured()) return demoReply(b, history);

  const woo = wooCreds(b);
  const client = new Anthropic();
  const tools = [...(woo ? STORE_TOOLS : []), ...(b.quotesEnabled ? [QUOTE_TOOL] : []), RESPOND_TOOL];
  const hasTools = tools.length > 1;
  const messages = toApiMessages(history.slice(-30));
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: buildSystemPrompt(b, Boolean(woo)), cache_control: { type: "ephemeral" } },
  ];
  // Images may only come from real search results or the business's own catalog text.
  const seenImages = new Set<string>(b.catalog.match(IMAGE_URL_RE) ?? []);
  const env: ToolEnv = { b, woo, ctx, allowedImages: seenImages, documents: [], quoteSummaries: [] };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS - 1;
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 1000,
      system,
      tools,
      // Must always call a tool; on the last round force the final reply.
      tool_choice: hasTools && !lastRound ? { type: "any" } : { type: "tool", name: "respond" },
      messages,
    });

    const uses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const respond = uses.find((u) => u.name === "respond");
    if (respond) {
      const result = parseRespond(respond.input as Record<string, unknown>);
      result.images = result.images?.filter((img) => seenImages.has(img.url));
      result.documents = env.documents;
      result.quoteSummary = env.quoteSummaries.join("\n\n") || undefined;
      return result;
    }
    if (!uses.length) {
      const text = res.content.find((c) => c.type === "text");
      return { reply: text && text.type === "text" ? text.text : "", handoff: !text };
    }

    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = await runTool(u.name, u.input as Record<string, unknown>, env);
      if ("products" in out && Array.isArray(out.products)) {
        for (const p of out.products as { image?: string }[]) if (p.image) seenImages.add(p.image);
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: "user", content: results });
  }
  return {
    reply: env.documents.length ? "تفضل، عرض السعر مرفق 👇" : "",
    handoff: !env.documents.length,
    handoffReason: "تعذر إكمال الرد الآلي",
    documents: env.documents,
    quoteSummary: env.quoteSummaries.join("\n\n") || undefined,
  };
}

/** Rule-based replies so the product can be demoed without an API key. */
function demoReply(b: Business, history: Pick<Message, "role" | "text">[]): AiResult {
  const last = [...history].reverse().find((m) => m.role === "CUSTOMER")?.text ?? "";
  const t = last.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (has("موظف", "شكوى", "مدير", "human", "agent", "زعلان", "سيء"))
    return {
      reply: "نعتذر جدًا عن أي إزعاج 🙏 سيتواصل معك أحد زملائنا خلال دقائق.",
      handoff: true,
      handoffReason: "العميل طلب موظفًا أو لديه شكوى",
    };
  if (has("سعر", "بكام", "كام", "أسعار", "اسعار", "price", "منيو", "قائمة"))
    return { reply: b.catalog ? `أكيد! دي أسعارنا:\n${b.catalog}` : "سأتأكد لك من الأسعار حالًا.", handoff: !b.catalog };
  if (has("مواعيد", "ساعات", "مفتوح", "امتى", "متى", "open", "hours"))
    return { reply: b.hours ? `مواعيدنا: ${b.hours}` : "سأتأكد لك من المواعيد.", handoff: !b.hours };
  if (has("عنوان", "فين", "وين", "location", "مكان"))
    return { reply: b.location ? `عنواننا: ${b.location}` : "سأرسل لك العنوان حالًا.", handoff: !b.location };
  if (has("احجز", "حجز", "موعد", "book"))
    return { reply: "تمام! ممكن اسم حضرتك والخدمة المطلوبة واليوم والوقت المناسب؟", handoff: false };
  if (has("أطلب", "اطلب", "عايز", "أريد", "اريد", "order"))
    return { reply: "تمام! اكتب لي الأصناف والكمية والعنوان ورقم التواصل وسأجهز الطلب.", handoff: false };
  if (has("سلام", "مرحبا", "اهلا", "أهلا", "hi", "hello"))
    return { reply: `أهلًا بيك في ${b.name} 👋 كيف أقدر أساعدك؟`, handoff: false };
  return {
    reply: "(وضع تجريبي بدون مفتاح Claude) شكرًا لرسالتك! سيتم الرد عليك قريبًا.",
    handoff: false,
  };
}
