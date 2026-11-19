import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { requireBusinessAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { businesses, leads } from "@/db/schema";
import { toggleBot } from "@/app/actions";
import { getTemplate } from "@/lib/templates";
import { NavTabs } from "./nav-tabs";

export default async function BusinessLayout({ children, params }: LayoutProps<"/dashboard/b/[id]">) {
  const { id } = await params;
  await requireBusinessAccess(id);
  const b = await db.query.businesses.findFirst({ where: eq(businesses.id, id) });
  if (!b) notFound();
  const [{ value: newLeads }] = await db
    .select({ value: count() })
    .from(leads)
    .where(and(eq(leads.businessId, id), eq(leads.status, "NEW")));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{getTemplate(b.template).emoji}</span>
          <div>
            <h1 className="text-2xl font-black">{b.name}</h1>
            <p className="text-xs text-gray-500">
              {b.waPhoneNumberId ? "✅ واتساب مربوط" : "⚠️ واتساب غير مربوط — جرّب البوت من المحاكي"}
            </p>
          </div>
        </div>
        <form action={toggleBot.bind(null, b.id)}>
          <button className={b.botEnabled ? "btn" : "btn-ghost"}>
            {b.botEnabled ? "🤖 البوت يعمل" : "⏸️ البوت متوقف — تشغيل"}
          </button>
        </form>
      </div>
      <NavTabs id={b.id} newLeads={newLeads} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
