import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, leads } from "@/db/schema";
import { setLeadStatus } from "@/app/actions";
import { AutoRefresh } from "@/components/ui";
import { formatDateTime, LEAD_LABEL, LEAD_STATUS_LABEL, maskPhone } from "@/lib/format";

const STATUS_STYLE = {
  NEW: "bg-amber-100 text-amber-800",
  DONE: "bg-brand-100 text-brand-700",
  CANCELLED: "bg-gray-100 text-gray-500",
} as const;

export default async function LeadsPage({ params }: PageProps<"/dashboard/b/[id]/leads">) {
  const { id } = await params;
  const rows = await db
    .select({ l: leads, c: conversations })
    .from(leads)
    .innerJoin(conversations, eq(conversations.id, leads.conversationId))
    .where(eq(leads.businessId, id))
    .orderBy(desc(leads.createdAt))
    .limit(300);

  return (
    <div>
      <AutoRefresh seconds={10} />
      {rows.length === 0 ? (
        <div className="card text-center text-gray-500">
          الطلبات والحجوزات التي يجمعها البوت من العملاء ستظهر هنا منظمة وجاهزة للتنفيذ.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(({ l, c }) => (
            <div key={l.id} className="card">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand-700">{LEAD_LABEL[l.kind]}</span>
                  <span className={`badge ${STATUS_STYLE[l.status]}`}>{LEAD_STATUS_LABEL[l.status]}</span>
                  {c.isSimulator && <span className="badge bg-purple-100 text-purple-700">تجريبي</span>}
                </div>
                <span className="text-xs text-gray-400">{formatDateTime(l.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{l.details}</p>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                <Link href={`/dashboard/b/${id}/c/${c.id}`} className="text-brand-700">
                  {c.customerName ?? maskPhone(c.customerPhone)} ← المحادثة
                </Link>
                <div className="flex gap-2">
                  {l.status !== "DONE" && (
                    <form action={setLeadStatus.bind(null, l.id, "DONE")}>
                      <button className="btn px-3 py-1">✓ تم</button>
                    </form>
                  )}
                  {l.status === "NEW" && (
                    <form action={setLeadStatus.bind(null, l.id, "CANCELLED")}>
                      <button className="btn-ghost px-3 py-1">إلغاء</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
