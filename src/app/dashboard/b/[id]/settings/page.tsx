import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ params, searchParams }: PageProps<"/dashboard/b/[id]/settings">) {
  const { id } = await params;
  const { created } = await searchParams;
  const session = await getSession();
  const b = await db.query.businesses.findFirst({ where: eq(businesses.id, id) });
  if (!b) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <div>
      {created && (
        <div className="mb-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          🎉 تم إنشاء النشاط ببيانات نموذجية. عدّل المعلومات لتطابق النشاط الحقيقي، ثم جرّب البوت من تبويب «المحاكي».
        </div>
      )}
      <SettingsForm
        business={{
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
          hours: b.hours,
          location: b.location,
          catalog: b.catalog,
          faqs: b.faqs,
          policies: b.policies,
          tone: b.tone,
          extraInstructions: b.extraInstructions,
          handoffKeywords: b.handoffKeywords,
          waPhoneNumberId: b.waPhoneNumberId ?? "",
          hasToken: Boolean(b.waAccessToken),
          hasPassword: Boolean(b.passwordHash),
          wooUrl: b.wooUrl ?? "",
          hasWooKeys: Boolean(b.wooConsumerKey && b.wooConsumerSecret),
          quotesEnabled: b.quotesEnabled,
          quoteCurrency: b.quoteCurrency,
          quoteTaxRate: b.quoteTaxRate,
          quoteValidDays: b.quoteValidDays,
          quoteTerms: b.quoteTerms,
        }}
        isAdmin={session?.role === "admin"}
        webhookUrl={`${origin}/api/whatsapp/webhook`}
      />
    </div>
  );
}
