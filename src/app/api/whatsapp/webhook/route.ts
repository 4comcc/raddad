import { after, type NextRequest } from "next/server";
import { getBusinessByPhoneNumberId, processConversation, receiveCustomerMessage } from "@/lib/engine";
import { markRead, parseInbound, verifySignature } from "@/lib/whatsapp";

export const maxDuration = 60;

// Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    process.env.WA_VERIFY_TOKEN &&
    p.get("hub.verify_token") === process.env.WA_VERIFY_TOKEN
  ) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const DEBOUNCE_MS = 2500; // wait so bursts of messages get one combined answer

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const inbound = parseInbound(body);
  const jobs: { conversationId: string; messageId: string }[] = [];

  for (const m of inbound) {
    const business = await getBusinessByPhoneNumberId(m.phoneNumberId);
    if (!business) continue;
    const stored = await receiveCustomerMessage({
      business,
      phone: m.from,
      name: m.name,
      text: m.text,
      waMessageId: m.messageId,
    });
    if (!stored) continue; // duplicate delivery
    if (business.waAccessToken) {
      void markRead({ phoneNumberId: m.phoneNumberId, token: business.waAccessToken, messageId: m.messageId });
    }
    jobs.push({ conversationId: stored.conversation.id, messageId: stored.message.id });
  }

  // Acknowledge Meta immediately; reply in the background.
  if (jobs.length) {
    after(async () => {
      await new Promise((r) => setTimeout(r, DEBOUNCE_MS));
      for (const j of jobs) {
        try {
          await processConversation(j.conversationId, j.messageId);
        } catch (e) {
          console.error("processConversation failed", e);
        }
      }
    });
  }

  return Response.json({ ok: true });
}
