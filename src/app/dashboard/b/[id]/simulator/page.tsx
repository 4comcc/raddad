import { loadSimulator } from "@/app/actions";
import { aiConfigured } from "@/lib/ai";
import { Simulator } from "./simulator";

export default async function SimulatorPage({ params }: PageProps<"/dashboard/b/[id]/simulator">) {
  const { id } = await params;
  const initial = await loadSimulator(id);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Simulator businessId={id} initial={initial} />
      <aside className="card h-fit space-y-3 text-sm text-gray-600">
        <h3 className="font-bold text-gray-900">كيف تستخدم المحاكي؟</h3>
        <p>اكتب كأنك عميل يراسل النشاط على واتساب. البوت يرد بنفس المنطق والمعلومات التي سيستخدمها مع العملاء الحقيقيين.</p>
        <p>جرّب: السؤال عن الأسعار، طلب حجز أو طلب كامل، سؤال خارج المعلومات، أو كتابة «عايز أكلم موظف».</p>
        <p>الطلبات المسجلة هنا تظهر في تبويب الطلبات بعلامة «تجريبي».</p>
        {!aiConfigured() && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-800">
            ⚠️ لم يُضبط مفتاح Claude (ANTHROPIC_API_KEY) — البوت يعمل الآن في وضع تجريبي بردود بسيطة ثابتة.
          </p>
        )}
      </aside>
    </div>
  );
}
