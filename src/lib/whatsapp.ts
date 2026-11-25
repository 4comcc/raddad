import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

const graph = () =>
  `${process.env.WA_GRAPH_BASE || "https://graph.facebook.com"}/${process.env.WA_GRAPH_VERSION || "v21.0"}`;

export function verifySignature(rawBody: string, header: string | null) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) {
    // Allowed only outside production so local testing works.
    return process.env.NODE_ENV !== "production";
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function sendText(opts: { phoneNumberId: string; token: string; to: string; text: string }) {
  return postMessage(opts, { type: "text", text: { preview_url: true, body: opts.text.slice(0, 4096) } });
}

export async function sendImage(opts: { phoneNumberId: string; token: string; to: string; imageUrl: string; caption?: string }) {
  return postMessage(opts, {
    type: "image",
    image: { link: opts.imageUrl, ...(opts.caption ? { caption: opts.caption.slice(0, 1024) } : {}) },
  });
}

export async function sendDocument(opts: {
  phoneNumberId: string;
  token: string;
  to: string;
  link: string;
  fileName: string;
  caption?: string;
}) {
  return postMessage(opts, {
    type: "document",
    document: { link: opts.link, filename: opts.fileName, ...(opts.caption ? { caption: opts.caption.slice(0, 1024) } : {}) },
  });
}

async function postMessage(opts: { phoneNumberId: string; token: string; to: string }, payload: Record<string, unknown>) {
  const res = await fetch(`${graph()}/${opts.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: opts.to, ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    const code = data.error?.code;
    // 131047: outside the 24h customer-service window
    const msg =
      code === 131047
        ? "انتهت نافذة الـ 24 ساعة — لا يمكن إرسال رسالة حرة حتى يراسلك العميل مجددًا (أو استخدم قالب رسالة معتمد)."
        : data.error?.message || `WhatsApp API error ${res.status}`;
    throw new Error(msg);
  }
  return data.messages?.[0]?.id ?? null;
}

export async function markRead(opts: { phoneNumberId: string; token: string; messageId: string }) {
  await fetch(`${graph()}/${opts.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: opts.messageId }),
  }).catch(() => {});
}

// ---- Webhook payload types (subset) ----
export type WaInbound = {
  phoneNumberId: string;
  from: string;
  name?: string;
  messageId: string;
  text: string;
};

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
        }[];
      };
    }[];
  }[];
};

const NON_TEXT_LABEL: Record<string, string> = {
  image: "[أرسل العميل صورة]",
  audio: "[أرسل العميل رسالة صوتية]",
  video: "[أرسل العميل فيديو]",
  document: "[أرسل العميل ملفًا]",
  sticker: "[أرسل العميل ملصقًا]",
  contacts: "[أرسل العميل جهة اتصال]",
};

export function parseInbound(body: unknown): WaInbound[] {
  const out: WaInbound[] = [];
  for (const entry of (body as WebhookBody)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      const phoneNumberId = v?.metadata?.phone_number_id;
      if (!phoneNumberId || !v?.messages) continue;
      for (const m of v.messages) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        let text =
          m.text?.body ??
          m.button?.text ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          (m.location
            ? `[موقع العميل] ${m.location.name ?? ""} ${m.location.address ?? ""} (${m.location.latitude}, ${m.location.longitude})`.trim()
            : undefined);
        text ??= NON_TEXT_LABEL[m.type] ?? `[رسالة من نوع ${m.type}]`;
        out.push({ phoneNumberId, from: m.from, name, messageId: m.id, text });
      }
    }
  }
  return out;
}
