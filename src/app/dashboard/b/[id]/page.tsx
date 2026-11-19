import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages } from "@/db/schema";
import { AutoRefresh } from "@/components/ui";
import { maskPhone, timeAgo } from "@/lib/format";

export default async function InboxPage({ params, searchParams }: PageProps<"/dashboard/b/[id]">) {
  const { id } = await params;
  const { filter } = await searchParams;
  const onlyAttention = filter === "attention";

  const lastText = sql<string>`(select ${messages.text} from ${messages} where ${messages.conversationId} = ${conversations.id} order by ${messages.createdAt} desc limit 1)`;
  const rows = await db
    .select({ c: conversations, lastText })
    .from(conversations)
    .where(
      and(
        eq(conversations.businessId, id),
        eq(conversations.isSimulator, false),
        onlyAttention ? eq(conversations.needsAttention, true) : undefined,
      ),
    )
    .orderBy(desc(conversations.needsAttention), desc(conversations.lastMessageAt))
    .limit(200);

  return (
    <div>
      <AutoRefresh seconds={8} />
      <div className="mb-3 flex gap-2 text-sm">
        <Link href={`/dashboard/b/${id}`} className={onlyAttention ? "btn-ghost" : "btn"}>
          الكل
        </Link>
        <Link href={`/dashboard/b/${id}?filter=attention`} className={onlyAttention ? "btn" : "btn-ghost"}>
          تحتاج تدخل
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="card text-center text-gray-500">
          لا توجد محادثات بعد. بعد ربط رقم واتساب ستظهر هنا رسائل العملاء وردود البوت لحظة بلحظة.
          <br />
          <Link href={`/dashboard/b/${id}/simulator`} className="mt-3 inline-block font-semibold text-brand-700">
            جرّب البوت في المحاكي ←
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-gray-100 p-0">
          {rows.map(({ c, lastText }) => (
            <li key={c.id}>
              <Link href={`/dashboard/b/${id}/c/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                  {(c.customerName ?? "?").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{c.customerName ?? maskPhone(c.customerPhone)}</span>
                    {c.mode === "HUMAN" && <span className="badge bg-blue-100 text-blue-700">موظف</span>}
                    {c.needsAttention && <span className="badge bg-red-100 text-red-700">{c.attentionNote ?? "تحتاج تدخل"}</span>}
                  </div>
                  <p className="truncate text-sm text-gray-500">{lastText}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">{timeAgo(c.lastMessageAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
