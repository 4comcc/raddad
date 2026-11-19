import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Business, Message } from "@/db/schema";

export type AiResult = {
  reply: string;
  handoff: boolean;
  handoffReason?: string;
  lead?: { kind: "ORDER" | "BOOKING" | "INQUIRY"; details: string };
  customerName?: string;
};

const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond",
  description: "Send the reply to the customer on WhatsApp, and optionally record an order/booking or hand off to a human.",
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
          "true if a human staff member must take over: complaint, angry customer, explicit request for a human, or a question the business info cannot answer and that matters for a sale.",
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
      customer_name: { type: "string", description: "Customer's name if they mentioned it." },
    },
    required: ["reply", "handoff"],
  },
};

export function buildSystemPrompt(b: Business) {
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}\n` : "");
  return `أنت موظف خدمة العملاء على واتساب لنشاط "${b.name}". تتحدث باسم النشاط كأنك أحد موظفيه.

قواعد أساسية:
- رد بلغة العميل ولهجته (عربي بأي لهجة، أو إنجليزي، أو غيره).
- الأسلوب: ${b.tone || "ودود ومختصر"}. رسائل واتساب قصيرة (1–4 أسطر غالبًا)، بدون عناوين أو تنسيق Markdown.
- اعتمد فقط على معلومات النشاط أدناه. لا تخترع أسعارًا أو منتجات أو مواعيد أو سياسات غير مذكورة.
- إذا سُئلت عن شيء غير موجود في المعلومات: قل بلطف إنك ستتأكد من الزملاء، واجعل handoff = true.
- عند طلب أو حجز: اجمع التفاصيل الناقصة سؤالًا بسؤال، ثم لخّص الطلب واطلب تأكيد العميل. بعد التأكيد فقط سجّل lead.
- إذا اشتكى العميل أو غضب أو طلب التحدث مع إنسان: اعتذر بلطف وأخبره أن زميلًا سيتواصل معه قريبًا، واجعل handoff = true.
- لا تذكر أنك ذكاء اصطناعي إلا إذا سُئلت مباشرة؛ وإن سُئلت فكن صادقًا وقل إنك مساعد آلي للنشاط.
- استخدم الأداة respond دائمًا لإرسال ردك.

# معلومات النشاط
${section("نبذة", b.description)}${section("مواعيد العمل", b.hours)}${section("العنوان / الفروع", b.location)}${section("المنتجات والخدمات والأسعار", b.catalog)}${section("أسئلة شائعة", b.faqs)}${section("السياسات", b.policies)}${section("تعليمات خاصة", b.extraInstructions)}`;
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

export async function generateReply(b: Business, history: Pick<Message, "role" | "text">[]): Promise<AiResult> {
  if (!aiConfigured()) return demoReply(b, history);

  const client = new Anthropic();
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
    max_tokens: 800,
    system: [{ type: "text", text: buildSystemPrompt(b), cache_control: { type: "ephemeral" } }],
    tools: [RESPOND_TOOL],
    tool_choice: { type: "tool", name: "respond" },
    messages: toApiMessages(history.slice(-30)),
  });

  const tool = res.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    const text = res.content.find((c) => c.type === "text");
    return { reply: text && text.type === "text" ? text.text : "", handoff: !text };
  }
  const input = tool.input as {
    reply?: string;
    handoff?: boolean;
    handoff_reason?: string;
    lead?: AiResult["lead"];
    customer_name?: string;
  };
  return {
    reply: (input.reply ?? "").trim(),
    handoff: Boolean(input.handoff),
    handoffReason: input.handoff_reason,
    lead: input.lead?.details ? input.lead : undefined,
    customerName: input.customer_name,
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
