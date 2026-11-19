import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, conversations, leads, messages, type Business } from "@/db/schema";
import { generateReply } from "@/lib/ai";
import { sendText } from "@/lib/whatsapp";

/** Store an inbound customer message. Returns null if it was a duplicate webhook delivery. */
export async function receiveCustomerMessage(opts: {
  business: Business;
  phone: string;
  name?: string;
  text: string;
  waMessageId?: string;
  isSimulator?: boolean;
}) {
  const now = new Date();
  const [conv] = await db
    .insert(conversations)
    .values({
      businessId: opts.business.id,
      customerPhone: opts.phone,
      customerName: opts.name,
      isSimulator: opts.isSimulator ?? false,
      lastMessageAt: now,
      lastCustomerAt: now,
    })
    .onConflictDoUpdate({
      target: [conversations.businessId, conversations.customerPhone],
      set: {
        lastMessageAt: now,
        lastCustomerAt: now,
        customerName: sql`coalesce(${conversations.customerName}, excluded.customer_name)`,
      },
    })
    .returning();

  const inserted = await db
    .insert(messages)
    .values({ conversationId: conv.id, role: "CUSTOMER", text: opts.text, waMessageId: opts.waMessageId })
    .onConflictDoNothing({ target: messages.waMessageId })
    .returning();

  if (!inserted.length) return null;
  return { conversation: conv, message: inserted[0] };
}

function matchesHandoffKeyword(b: Business, text: string) {
  const t = text.toLowerCase();
  return b.handoffKeywords
    .split(/[,،\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => t.includes(k));
}

/**
 * Let the assistant answer the latest customer message(s) in a conversation.
 * `triggerMessageId`: skip if a newer customer message arrived meanwhile (it will trigger its own run).
 */
export async function processConversation(conversationId: string, triggerMessageId?: string) {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: { business: true },
  });
  if (!conv) return { skipped: "not_found" as const };
  const b = conv.business;
  if (conv.mode !== "BOT" || !b.botEnabled) return { skipped: "human_mode" as const };

  const history = await db
    .select({ id: messages.id, role: messages.role, text: messages.text })
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(desc(messages.createdAt))
    .limit(40)
    .then((r) => r.reverse());

  const lastCustomer = [...history].reverse().find((m) => m.role === "CUSTOMER");
  if (!lastCustomer) return { skipped: "no_customer_message" as const };
  if (triggerMessageId && lastCustomer.id !== triggerMessageId) return { skipped: "superseded" as const };
  // Already answered?
  if (history[history.length - 1]?.role !== "CUSTOMER") return { skipped: "answered" as const };

  let result;
  if (matchesHandoffKeyword(b, lastCustomer.text)) {
    result = {
      reply: "تمام، سيتواصل معك أحد زملائنا في أقرب وقت 🙏",
      handoff: true,
      handoffReason: "العميل طلب التحدث مع موظف",
    };
  } else {
    try {
      result = await generateReply(b, history);
    } catch (e) {
      console.error("AI error", e);
      result = {
        reply: "",
        handoff: true,
        handoffReason: `تعذر توليد رد آلي: ${(e as Error).message}`.slice(0, 300),
      };
    }
  }

  let botMessageId: string | null = null;
  if (result.reply) {
    const [m] = await db
      .insert(messages)
      .values({ conversationId: conv.id, role: "BOT", text: result.reply })
      .returning();
    botMessageId = m.id;
  }

  if (result.lead) {
    await db.insert(leads).values({
      businessId: b.id,
      conversationId: conv.id,
      kind: result.lead.kind,
      details: result.lead.details,
    });
  }

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      ...(result.customerName && !conv.customerName ? { customerName: result.customerName } : {}),
      ...(result.handoff
        ? { mode: "HUMAN" as const, needsAttention: true, attentionNote: result.handoffReason ?? "يحتاج تدخل موظف" }
        : {}),
      ...(result.lead && !result.handoff ? { needsAttention: true, attentionNote: "طلب/حجز جديد" } : {}),
    })
    .where(eq(conversations.id, conv.id));

  if (result.reply && botMessageId && !conv.isSimulator) {
    await deliver(b, conv.customerPhone, botMessageId, result.reply);
  }
  return { reply: result.reply, handoff: result.handoff, lead: result.lead };
}

/** Send a stored outbound message over WhatsApp and record the outcome. */
export async function deliver(b: Business, to: string, messageId: string, text: string) {
  if (!b.waPhoneNumberId || !b.waAccessToken) {
    await db.update(messages).set({ error: "واتساب غير مربوط لهذا النشاط" }).where(eq(messages.id, messageId));
    return;
  }
  try {
    const waId = await sendText({ phoneNumberId: b.waPhoneNumberId, token: b.waAccessToken, to, text });
    await db.update(messages).set({ waMessageId: waId, error: null }).where(eq(messages.id, messageId));
  } catch (e) {
    await db
      .update(messages)
      .set({ error: (e as Error).message.slice(0, 500) })
      .where(eq(messages.id, messageId));
  }
}

/** A staff member replies from the dashboard. */
export async function sendAgentReply(conversationId: string, text: string) {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: { business: true },
  });
  if (!conv) throw new Error("Conversation not found");
  const [m] = await db.insert(messages).values({ conversationId, role: "AGENT", text }).returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), needsAttention: false, attentionNote: null, mode: "HUMAN" })
    .where(eq(conversations.id, conversationId));
  if (!conv.isSimulator) await deliver(conv.business, conv.customerPhone, m.id, text);
}

export async function getConversationMessages(conversationId: string) {
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function getBusinessByPhoneNumberId(phoneNumberId: string) {
  return db.query.businesses.findFirst({ where: eq(businesses.waPhoneNumberId, phoneNumberId) });
}

export async function resetSimulator(businessId: string, phone: string) {
  await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.businessId, businessId),
        eq(conversations.customerPhone, phone),
        eq(conversations.isSimulator, true),
      ),
    );
}
