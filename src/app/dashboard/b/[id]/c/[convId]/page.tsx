import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, leads } from "@/db/schema";
import { getConversationMessages } from "@/lib/engine";
import { dismissAttention, setConversationMode } from "@/app/actions";
import { AutoRefresh } from "@/components/ui";
import { ChatBubble } from "@/components/chat-bubble";
import { formatDateTime, isWithin24h, LEAD_LABEL, maskPhone } from "@/lib/format";
import { ReplyBox } from "./reply-box";

export default async function ConversationPage({ params }: PageProps<"/dashboard/b/[id]/c/[convId]">) {
  const { id, convId } = await params;
  const conv = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, convId), eq(conversations.businessId, id)),
  });
  if (!conv) notFound();
  const msgs = await getConversationMessages(conv.id);
  const convLeads = await db.select().from(leads).where(eq(leads.conversationId, conv.id)).orderBy(desc(leads.createdAt));
  const windowOpen = isWithin24h(conv.lastCustomerAt);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <AutoRefresh seconds={4} />
      <div className="card flex h-[70vh] flex-col p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <Link href={`/dashboard/b/${id}`} className="text-xs text-gray-500">
              → المحادثات
            </Link>
            <div className="font-bold">{conv.customerName ?? "عميل"}</div>
            <div className="text-xs text-gray-500" dir="ltr">
              {conv.isSimulator ? "محاكي" : `+${conv.customerPhone}`}
            </div>
          </div>
          <div className="flex gap-2">
            {conv.mode === "BOT" ? (
              <form action={setConversationMode.bind(null, conv.id, "HUMAN")}>
                <button className="btn-ghost">✋ استلام المحادثة</button>
              </form>
            ) : (
              <form action={setConversationMode.bind(null, conv.id, "BOT")}>
                <button className="btn">🤖 إعادة للبوت</button>
              </form>
            )}
          </div>
        </div>
        {conv.needsAttention && (
          <div className="flex items-center justify-between bg-red-50 px-5 py-2 text-sm text-red-700">
            <span>⚠️ {conv.attentionNote ?? "تحتاج تدخل"}</span>
            <form action={dismissAttention.bind(null, conv.id)}>
              <button className="font-semibold underline">تم</button>
            </form>
          </div>
        )}
        <div className="flex flex-1 flex-col-reverse overflow-y-auto bg-[#efeae2] px-4 py-4">
          <div className="space-y-2">
            {msgs.map((m) => (
              <ChatBubble key={m.id} role={m.role} text={m.text} time={m.createdAt} error={m.error} mediaUrl={m.mediaUrl}
                mediaType={m.mediaType}
                fileName={m.fileName}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 p-3">
          {conv.mode === "BOT" && (
            <p className="mb-2 text-xs text-gray-500">البوت يرد على هذه المحادثة. إرسال رد منك سيحوّلها لوضع الموظف.</p>
          )}
          {!windowOpen && !conv.isSimulator && (
            <p className="mb-2 text-xs text-amber-700">
              مرّت أكثر من 24 ساعة على آخر رسالة من العميل — واتساب لا يسمح برسالة حرة حتى يراسلك مجددًا.
            </p>
          )}
          <ReplyBox conversationId={conv.id} />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card">
          <h3 className="mb-2 font-bold">العميل</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">الاسم</dt>
              <dd>{conv.customerName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الرقم</dt>
              <dd dir="ltr">{maskPhone(conv.customerPhone)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الوضع</dt>
              <dd>{conv.mode === "BOT" ? "البوت" : "موظف"}</dd>
            </div>
          </dl>
        </div>
        <div className="card">
          <h3 className="mb-2 font-bold">طلبات وحجوزات</h3>
          {convLeads.length === 0 ? (
            <p className="text-sm text-gray-500">لا يوجد</p>
          ) : (
            <ul className="space-y-3">
              {convLeads.map((l) => (
                <li key={l.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span className="font-bold text-brand-700">{LEAD_LABEL[l.kind]}</span>
                    <span>{formatDateTime(l.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{l.details}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
