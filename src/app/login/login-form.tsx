"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="slug">
          معرّف النشاط
        </label>
        <input id="slug" name="slug" className="input" dir="ltr" placeholder="my-clinic" autoComplete="username" />
        <p className="hint">اتركه فارغًا لدخول مدير المنصة.</p>
      </div>
      <div>
        <label className="label" htmlFor="password">
          كلمة المرور
        </label>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">دخول</SubmitButton>
    </form>
  );
}
