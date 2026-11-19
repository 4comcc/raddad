"use client";

import { useActionState, useState } from "react";
import { createBusiness } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/ui";

export function NewBusinessForm({ templates }: { templates: { key: string; label: string; emoji: string }[] }) {
  const [state, action] = useActionState(createBusiness, undefined);
  const [template, setTemplate] = useState(templates[0].key);
  return (
    <form action={action} className="card space-y-5">
      <div>
        <span className="label">نوع النشاط</span>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {templates.map((t) => (
            <label
              key={t.key}
              className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold transition ${
                template === t.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="template"
                value={t.key}
                checked={template === t.key}
                onChange={() => setTemplate(t.key)}
                className="sr-only"
              />
              <span className="text-xl">{t.emoji}</span> {t.label}
            </label>
          ))}
        </div>
        <p className="hint">سنملأ بيانات نموذجية يمكنك تعديلها بعد ذلك.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">
          اسم النشاط
        </label>
        <input id="name" name="name" className="input" required placeholder="عيادة د. أحمد للأسنان" />
      </div>
      <div>
        <label className="label" htmlFor="slug">
          المعرّف (للدخول)
        </label>
        <input id="slug" name="slug" className="input" dir="ltr" required placeholder="dr-ahmed-dental" />
        <p className="hint">أحرف إنجليزية صغيرة وأرقام وشرطة. يستخدمه العميل لتسجيل الدخول.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton>إنشاء النشاط</SubmitButton>
    </form>
  );
}
