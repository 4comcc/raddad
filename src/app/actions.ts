"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { businesses, conversations, leads } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  requireBusinessAccess,
  safeEqual,
  verifyPassword,
} from "@/lib/auth";
import { getTemplate } from "@/lib/templates";
import { normalizeStoreUrl, testConnection, wooCreds } from "@/lib/woocommerce";
import {
  getConversationMessages,
  processConversation,
  receiveCustomerMessage,
  resetSimulator,
  sendAgentReply,
} from "@/lib/engine";

export type FormState = { error?: string; ok?: string } | undefined;

// ---------- Auth ----------
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  if (!password) return { error: "أدخل كلمة المرور" };

  if (!slug) {
    const admin = process.env.ADMIN_PASSWORD;
    if (!admin || !safeEqual(password, admin)) return { error: "بيانات الدخول غير صحيحة" };
    await createSession({ role: "admin" });
  } else {
    const b = await db.query.businesses.findFirst({ where: eq(businesses.slug, slug) });
    if (!b || !verifyPassword(password, b.passwordHash)) return { error: "بيانات الدخول غير صحيحة" };
    await createSession({ role: "business", businessId: b.id });
  }
  redirect(next.startsWith("/dashboard") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Businesses ----------
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,40}$/, "المعرّف: أحرف إنجليزية صغيرة وأرقام وشرطة فقط (3–40)");

export async function createBusiness(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const slug = slugSchema.safeParse(form.get("slug"));
  if (!name) return { error: "اكتب اسم النشاط" };
  if (!slug.success) return { error: slug.error.issues[0].message };
  const exists = await db.query.businesses.findFirst({ where: eq(businesses.slug, slug.data) });
  if (exists) return { error: "هذا المعرّف مستخدم" };

  const t = getTemplate(String(form.get("template") ?? "general"));
  const [b] = await db
    .insert(businesses)
    .values({
      name,
      slug: slug.data,
      template: t.key,
      description: t.description,
      hours: t.hours,
      catalog: t.catalog,
      faqs: t.faqs,
      policies: t.policies,
      extraInstructions: t.extraInstructions,
    })
    .returning();
  redirect(`/dashboard/b/${b.id}/settings?created=1`);
}

const knowledgeFields = [
  "name",
  "description",
  "hours",
  "location",
  "catalog",
  "faqs",
  "policies",
  "tone",
  "extraInstructions",
  "handoffKeywords",
] as const;

export async function updateBusiness(businessId: string, _: FormState, form: FormData): Promise<FormState> {
  const session = await requireBusinessAccess(businessId);
  const data: Partial<typeof businesses.$inferInsert> = {};
  for (const f of knowledgeFields) {
    const v = form.get(f);
    if (v !== null) data[f] = String(v).slice(0, 20000);
  }
  if (data.name !== undefined && !data.name.trim()) return { error: "اسم النشاط مطلوب" };

  const phoneId = form.get("waPhoneNumberId");
  if (phoneId !== null) data.waPhoneNumberId = String(phoneId).trim() || null;
  const token = String(form.get("waAccessToken") ?? "").trim();
  if (token) data.waAccessToken = token; // empty = keep existing

  // Quotes
  if (form.get("quotesSection") !== null) {
    data.quotesEnabled = form.get("quotesEnabled") === "on";
    data.quoteCurrency = String(form.get("quoteCurrency") ?? "").trim().slice(0, 20);
    const tax = Number(form.get("quoteTaxRate") ?? 0);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) return { error: "نسبة الضريبة يجب أن تكون بين 0 و 100" };
    data.quoteTaxRate = tax;
    const days = Math.round(Number(form.get("quoteValidDays") ?? 7));
    data.quoteValidDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 7;
    data.quoteTerms = String(form.get("quoteTerms") ?? "").slice(0, 3000);
  }

  // WooCommerce
  const wooUrl = form.get("wooUrl");
  if (wooUrl !== null) {
    const u = String(wooUrl).trim();
    if (!u) {
      data.wooUrl = null;
      data.wooConsumerKey = null;
      data.wooConsumerSecret = null;
    } else {
      const normalized = normalizeStoreUrl(u);
      if (!/^https:\/\//.test(normalized)) return { error: "رابط المتجر يجب أن يبدأ بـ https://" };
      data.wooUrl = normalized;
      const ck = String(form.get("wooConsumerKey") ?? "").trim();
      const cs = String(form.get("wooConsumerSecret") ?? "").trim();
      if (ck) data.wooConsumerKey = ck;
      if (cs) data.wooConsumerSecret = cs;
    }
  }

  if (session.role === "admin") {
    const pw = String(form.get("clientPassword") ?? "");
    if (pw) {
      if (pw.length < 8) return { error: "كلمة مرور العميل 8 أحرف على الأقل" };
      data.passwordHash = hashPassword(pw);
    }
  }

  try {
    await db.update(businesses).set(data).where(eq(businesses.id, businessId));
  } catch (e) {
    if (String((e as Error).message).includes("wa_phone_number_id")) {
      return { error: "معرّف رقم واتساب مربوط بنشاط آخر" };
    }
    throw e;
  }
  revalidatePath(`/dashboard/b/${businessId}`, "layout");
  return { ok: "تم الحفظ ✓" };
}

export async function toggleBot(businessId: string) {
  await requireBusinessAccess(businessId);
  const b = await db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
  if (!b) return;
  await db.update(businesses).set({ botEnabled: !b.botEnabled }).where(eq(businesses.id, businessId));
  revalidatePath(`/dashboard/b/${businessId}`, "layout");
}

// ---------- Conversations ----------
async function convWithAccess(conversationId: string) {
  const conv = await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId) });
  if (!conv) throw new Error("Not found");
  await requireBusinessAccess(conv.businessId);
  return conv;
}

export async function setConversationMode(conversationId: string, mode: "BOT" | "HUMAN") {
  const conv = await convWithAccess(conversationId);
  await db
    .update(conversations)
    .set({ mode, ...(mode === "BOT" ? { needsAttention: false, attentionNote: null } : {}) })
    .where(eq(conversations.id, conversationId));
  revalidatePath(`/dashboard/b/${conv.businessId}`, "layout");
}

export async function dismissAttention(conversationId: string) {
  const conv = await convWithAccess(conversationId);
  await db
    .update(conversations)
    .set({ needsAttention: false, attentionNote: null })
    .where(eq(conversations.id, conversationId));
  revalidatePath(`/dashboard/b/${conv.businessId}`, "layout");
}

export async function agentReply(conversationId: string, _: FormState, form: FormData): Promise<FormState> {
  const conv = await convWithAccess(conversationId);
  const text = String(form.get("text") ?? "").trim();
  if (!text) return { error: "اكتب الرسالة" };
  await sendAgentReply(conversationId, text);
  revalidatePath(`/dashboard/b/${conv.businessId}`, "layout");
  return { ok: "تم الإرسال" };
}

// ---------- Leads ----------
export async function setLeadStatus(leadId: string, status: "NEW" | "DONE" | "CANCELLED") {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return;
  await requireBusinessAccess(lead.businessId);
  await db.update(leads).set({ status }).where(and(eq(leads.id, leadId)));
  revalidatePath(`/dashboard/b/${lead.businessId}`, "layout");
}

// ---------- Simulator ----------
const simPhone = (businessId: string) => `sim-${businessId}`;

export async function simulateMessage(businessId: string, text: string) {
  await requireBusinessAccess(businessId);
  const business = await db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
  if (!business) throw new Error("Not found");
  const clean = text.trim().slice(0, 2000);
  if (clean) {
    const stored = await receiveCustomerMessage({
      business,
      phone: simPhone(businessId),
      name: "عميل تجريبي",
      text: clean,
      isSimulator: true,
    });
    if (stored) await processConversation(stored.conversation.id);
  }
  return loadSimulator(businessId);
}

export async function loadSimulator(businessId: string) {
  await requireBusinessAccess(businessId);
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.businessId, businessId), eq(conversations.customerPhone, simPhone(businessId))),
  });
  if (!conv) return { messages: [], mode: "BOT" as const, conversationId: null };
  const msgs = await getConversationMessages(conv.id);
  return {
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      fileName: m.fileName,
    })),
    mode: conv.mode,
    conversationId: conv.id,
  };
}

export async function resetSimulation(businessId: string) {
  await requireBusinessAccess(businessId);
  await resetSimulator(businessId, simPhone(businessId));
  revalidatePath(`/dashboard/b/${businessId}`, "layout");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function testWooConnection(businessId: string, _prev: FormState): Promise<FormState> {
  await requireBusinessAccess(businessId);
  const b = await db.query.businesses.findFirst({ where: eq(businesses.id, businessId) });
  const creds = b && wooCreds(b);
  if (!creds) return { error: "احفظ رابط المتجر والمفتاحين أولًا" };
  try {
    const r = await testConnection(creds);
    return {
      ok:
        `✓ الاتصال ناجح${r.sampleProduct ? ` — مثال منتج: ${r.sampleProduct}` : ""}` +
        (r.ordersOk ? " · الطلبات متاحة" : " · ⚠️ لا صلاحية لقراءة الطلبات (استعلام حالة الطلب لن يعمل)"),
    };
  } catch (e) {
    return { error: `فشل الاتصال: ${(e as Error).message}` };
  }
}
