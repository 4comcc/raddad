"use client";

import { useActionState } from "react";
import { updateBusiness } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/ui";

type B = {
  id: string;
  name: string;
  slug: string;
  description: string;
  hours: string;
  location: string;
  catalog: string;
  faqs: string;
  policies: string;
  tone: string;
  extraInstructions: string;
  handoffKeywords: string;
  waPhoneNumberId: string;
  hasToken: boolean;
  hasPassword: boolean;
};

function Field({
  name,
  label,
  hint,
  defaultValue,
  rows,
  dir,
  type,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  dir?: "ltr";
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {rows ? (
        <textarea id={name} name={name} rows={rows} defaultValue={defaultValue} className="input" dir={dir} placeholder={placeholder} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue} className="input" dir={dir} placeholder={placeholder} />
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function SettingsForm({ business: b, isAdmin, webhookUrl }: { business: B; isAdmin: boolean; webhookUrl: string }) {
  const [state, action] = useActionState(updateBusiness.bind(null, b.id), undefined);

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">معلومات النشاط</h2>
        <p className="-mt-2 text-sm text-gray-500">البوت يجيب فقط من هذه المعلومات — كلما كانت أدق كانت ردوده أفضل.</p>
        <Field name="name" label="اسم النشاط" defaultValue={b.name} />
        <Field name="description" label="نبذة" rows={2} defaultValue={b.description} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="hours" label="مواعيد العمل" rows={2} defaultValue={b.hours} />
          <Field name="location" label="العنوان / الفروع" rows={2} defaultValue={b.location} hint="يمكن إضافة رابط خرائط جوجل" />
        </div>
        <Field
          name="catalog"
          label="المنتجات والخدمات والأسعار"
          rows={8}
          defaultValue={b.catalog}
          hint="سطر لكل صنف: الاسم: السعر. يمكنك لصق المنيو أو قائمة الأسعار كما هي."
        />
        <Field name="faqs" label="أسئلة شائعة" rows={5} defaultValue={b.faqs} hint="سؤال؟ جواب. — سطر لكل سؤال" />
        <Field name="policies" label="السياسات (توصيل، إلغاء، استرجاع، دفع...)" rows={3} defaultValue={b.policies} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">سلوك البوت</h2>
        <Field name="tone" label="أسلوب الرد" defaultValue={b.tone} placeholder="ودود ومختصر، بلهجة العميل" />
        <Field
          name="extraInstructions"
          label="تعليمات خاصة"
          rows={4}
          defaultValue={b.extraInstructions}
          hint="مثال: عند الحجز اجمع الاسم والوقت. لا تعطِ خصومات. اقترح العرض الأسبوعي."
        />
        <Field
          name="handoffKeywords"
          label="كلمات التحويل الفوري لموظف"
          defaultValue={b.handoffKeywords}
          hint="مفصولة بفواصل. إذا كتبها العميل تتحول المحادثة لموظف مباشرة."
        />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">ربط واتساب (WhatsApp Cloud API)</h2>
        <ol className="list-inside list-decimal space-y-1 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <li>من Meta for Developers أنشئ تطبيقًا من نوع Business وأضف منتج WhatsApp.</li>
          <li>
            في إعدادات Webhook ضع الرابط:{" "}
            <code dir="ltr" className="rounded bg-white px-1">
              {webhookUrl}
            </code>{" "}
            ورمز التحقق (WA_VERIFY_TOKEN)، ثم اشترك في حقل <code>messages</code>.
          </li>
          <li>انسخ Phone number ID ورمز الوصول الدائم (System User token) والصقهما هنا.</li>
        </ol>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="waPhoneNumberId" label="Phone number ID" defaultValue={b.waPhoneNumberId} dir="ltr" />
          <Field
            name="waAccessToken"
            label="Access token"
            type="password"
            dir="ltr"
            placeholder={b.hasToken ? "•••••• محفوظ — اتركه فارغًا للإبقاء عليه" : "EAAG..."}
          />
        </div>
      </section>

      {isAdmin && (
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">دخول العميل</h2>
          <p className="-mt-2 text-sm text-gray-500">
            يدخل صاحب النشاط بالمعرّف{" "}
            <code dir="ltr" className="rounded bg-gray-100 px-1">
              {b.slug}
            </code>{" "}
            وكلمة المرور التالية ليرى محادثاته وطلباته فقط.
          </p>
          <Field
            name="clientPassword"
            label={b.hasPassword ? "تغيير كلمة مرور العميل" : "تعيين كلمة مرور العميل"}
            type="password"
            placeholder="8 أحرف على الأقل"
          />
        </section>
      )}

      <div className="sticky bottom-4 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur">
        <SubmitButton pendingText="جارٍ الحفظ...">حفظ التغييرات</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
