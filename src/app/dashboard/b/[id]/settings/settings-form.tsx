"use client";

import { useActionState } from "react";
import { testWooConnection, updateBusiness } from "@/app/actions";
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
  wooUrl: string;
  hasWooKeys: boolean;
  quotesEnabled: boolean;
  quoteCurrency: string;
  quoteTaxRate: number;
  quoteValidDays: number;
  quoteTerms: string;
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
          hint="سطر لكل صنف: الاسم: السعر. يمكنك لصق المنيو أو قائمة الأسعار كما هي، وإضافة رابط صورة المنتج (https://...jpg) في نفس السطر ليرسلها البوت."
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

      <section className="card space-y-4">
        <input type="hidden" name="quotesSection" value="1" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">عروض الأسعار</h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="quotesEnabled" defaultChecked={b.quotesEnabled} className="h-4 w-4 accent-emerald-600" />
            مفعّل
          </label>
        </div>
        <p className="-mt-2 text-sm text-gray-500">
          عندما يطلب العميل عرض سعر، يجهّزه البوت كملف PDF أو Excel ويرسله على واتساب، ويظهر في «الطلبات والحجوزات».
          الإجمالي والضريبة تُحسب تلقائيًا من الأسعار.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field name="quoteCurrency" label="العملة" defaultValue={b.quoteCurrency} placeholder="ريال / جنيه / درهم" />
          <Field name="quoteTaxRate" label="نسبة الضريبة %" type="number" defaultValue={String(b.quoteTaxRate)} placeholder="15" />
          <Field name="quoteValidDays" label="صلاحية العرض (أيام)" type="number" defaultValue={String(b.quoteValidDays)} />
        </div>
        <Field
          name="quoteTerms"
          label="الشروط في أسفل العرض"
          rows={3}
          defaultValue={b.quoteTerms}
          hint="مثال: الأسعار شاملة الضريبة. الدفع 50% مقدمًا. التوصيل خلال 3 أيام. — إن تُرك فارغًا تُستخدم «السياسات»."
        />
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">ربط متجر WooCommerce</h2>
          {b.wooUrl && b.hasWooKeys && <span className="badge bg-brand-100 text-brand-700">مربوط</span>}
        </div>
        <p className="-mt-2 text-sm text-gray-500">
          عند الربط يبحث البوت في منتجات المتجر مباشرة (السعر، التوفر، المقاسات، الرابط والصورة)، ويخبر العميل بحالة طلبه
          بعد التحقق من رقمه.
        </p>
        <ol className="list-inside list-decimal space-y-1 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <li>من لوحة ووردبريس: WooCommerce ← الإعدادات ← متقدم ← REST API ← إضافة مفتاح.</li>
          <li>
            اختر مستخدمًا مديرًا، والصلاحية <b>Read</b> (قراءة فقط تكفي)، ثم «إنشاء مفتاح API».
          </li>
          <li>انسخ Consumer key و Consumer secret والصقهما هنا، ثم احفظ واضغط «اختبار الاتصال».</li>
        </ol>
        <Field name="wooUrl" label="رابط المتجر" defaultValue={b.wooUrl} dir="ltr" placeholder="https://mystore.com" hint="اتركه فارغًا واحفظ لإلغاء الربط." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            name="wooConsumerKey"
            label="Consumer key"
            type="password"
            dir="ltr"
            placeholder={b.hasWooKeys ? "•••••• محفوظ — اتركه فارغًا للإبقاء عليه" : "ck_..."}
          />
          <Field
            name="wooConsumerSecret"
            label="Consumer secret"
            type="password"
            dir="ltr"
            placeholder={b.hasWooKeys ? "•••••• محفوظ — اتركه فارغًا للإبقاء عليه" : "cs_..."}
          />
        </div>
        {b.wooUrl && b.hasWooKeys && <WooTestButton businessId={b.id} />}
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

function WooTestButton({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(testWooConnection.bind(null, businessId), undefined);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" formAction={action} className="btn-ghost" disabled={pending}>
        {pending ? "جارٍ الاختبار..." : "اختبار الاتصال"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}
