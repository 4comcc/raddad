import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { businesses, conversations } from "@/db/schema";
import { getTemplate } from "@/lib/templates";

export default async function DashboardHome() {
  const session = await requireSession();
  if (session.role === "business") redirect(`/dashboard/b/${session.businessId}`);

  const rows = await db
    .select({
      b: businesses,
      convs: sql<number>`count(${conversations.id}) filter (where ${conversations.isSimulator} = false)`.mapWith(Number),
      attention: sql<number>`count(${conversations.id}) filter (where ${conversations.needsAttention})`.mapWith(Number),
    })
    .from(businesses)
    .leftJoin(conversations, eq(conversations.businessId, businesses.id))
    .groupBy(businesses.id)
    .orderBy(desc(businesses.createdAt));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black">الأنشطة</h1>
        <Link href="/dashboard/new" className="btn">
          + نشاط جديد
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="card text-center text-gray-500">
          لا توجد أنشطة بعد. أنشئ أول نشاط وجرّب البوت في المحاكي خلال دقيقة.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ b, convs, attention }) => (
            <Link key={b.id} href={`/dashboard/b/${b.id}`} className="card block transition hover:border-brand-500">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl">{getTemplate(b.template).emoji}</div>
                  <h2 className="mt-2 text-lg font-bold">{b.name}</h2>
                  <p className="text-xs text-gray-500" dir="ltr">
                    {b.slug}
                  </p>
                </div>
                <span className={`badge ${b.waPhoneNumberId ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"}`}>
                  {b.waPhoneNumberId ? "واتساب مربوط" : "غير مربوط"}
                </span>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-gray-600">
                <span>{convs} محادثة</span>
                {attention > 0 && <span className="font-bold text-red-600">{attention} تحتاج تدخل</span>}
                {!b.botEnabled && <span className="text-amber-600">البوت متوقف</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
