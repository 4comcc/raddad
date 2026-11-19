"use client";

import { useActionState, useEffect, useRef } from "react";
import { agentReply } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/ui";

export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(agentReply.bind(null, conversationId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <textarea
        name="text"
        rows={2}
        className="input resize-none"
        placeholder="اكتب ردك للعميل..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex flex-col items-end gap-1">
        <SubmitButton pendingText="...">إرسال</SubmitButton>
        {state?.error && <FormMessage state={state} />}
      </div>
    </form>
  );
}
