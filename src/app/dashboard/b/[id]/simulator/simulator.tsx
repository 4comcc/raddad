"use client";

import { useRef, useState, useTransition } from "react";
import { resetSimulation, setConversationMode, simulateMessage } from "@/app/actions";
import { ChatBubble } from "@/components/chat-bubble";

type Msg = { id: string; role: "CUSTOMER" | "BOT" | "AGENT" | "SYSTEM"; text: string; mediaUrl?: string | null };
type State = { messages: Msg[]; mode: "BOT" | "HUMAN"; conversationId: string | null };

export function Simulator({ businessId, initial }: { businessId: string; initial: State }) {
  const [state, setState] = useState<State>(initial);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function send() {
    const t = text.trim();
    if (!t || pending) return;
    setText("");
    setState((s) => ({ ...s, messages: [...s.messages, { id: `tmp-${Date.now()}`, role: "CUSTOMER", text: t }] }));
    startTransition(async () => {
      try {
        setState(await simulateMessage(businessId, t));
      } catch {
        setState((s) => ({
          ...s,
          messages: [...s.messages, { id: `err-${Date.now()}`, role: "SYSTEM", text: "حدث خطأ أثناء توليد الرد" }],
        }));
      }
      inputRef.current?.focus();
    });
  }

  function reset() {
    startTransition(async () => {
      await resetSimulation(businessId);
      setState({ messages: [], mode: "BOT", conversationId: null });
    });
  }

  function backToBot() {
    if (!state.conversationId) return;
    const id = state.conversationId;
    startTransition(async () => {
      await setConversationMode(id, "BOT");
      setState((s) => ({ ...s, mode: "BOT" }));
    });
  }

  return (
    <div className="mx-auto flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border-8 border-gray-900 bg-white shadow-xl">
      <div className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
        <div>
          <div className="font-bold">محاكي واتساب</div>
          <div className="text-xs opacity-80">{pending ? "يكتب..." : "متصل"}</div>
        </div>
        <button onClick={reset} disabled={pending} className="text-xs underline opacity-90">
          محادثة جديدة
        </button>
      </div>
      <div className="flex flex-1 flex-col-reverse overflow-y-auto bg-[#efeae2] p-3">
        <div className="space-y-2">
          {state.messages.length === 0 && (
            <p className="rounded-xl bg-white/70 p-3 text-center text-xs text-gray-500">ابدأ المحادثة كأنك عميل 👇</p>
          )}
          {state.messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} text={m.text} mediaUrl={m.mediaUrl} />
          ))}
          {pending && (
            <div className="flex justify-end">
              <div className="rounded-2xl bg-[#d9fdd3] px-3 py-2 text-sm text-gray-500">...</div>
            </div>
          )}
        </div>
      </div>
      {state.mode === "HUMAN" && (
        <div className="flex items-center justify-between bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span>تحوّلت المحادثة لموظف — البوت لن يرد.</span>
          <button onClick={backToBot} className="font-bold underline">
            إعادة للبوت
          </button>
        </div>
      )}
      <form
        className="flex gap-2 border-t border-gray-200 bg-gray-50 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input rounded-full"
          placeholder="اكتب رسالة"
          autoFocus
        />
        <button type="submit" disabled={pending || !text.trim()} className="btn rounded-full px-4">
          إرسال
        </button>
      </form>
    </div>
  );
}
