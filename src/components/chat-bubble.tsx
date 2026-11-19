const STYLE = {
  CUSTOMER: { side: "justify-start", bg: "bg-white", label: "" },
  BOT: { side: "justify-end", bg: "bg-[#d9fdd3]", label: "🤖 البوت" },
  AGENT: { side: "justify-end", bg: "bg-[#cfe9ff]", label: "👤 موظف" },
  SYSTEM: { side: "justify-center", bg: "bg-yellow-50", label: "" },
} as const;

export function ChatBubble({
  role,
  text,
  time,
  error,
}: {
  role: keyof typeof STYLE;
  text: string;
  time?: Date | string;
  error?: string | null;
}) {
  const s = STYLE[role];
  return (
    <div className={`flex ${s.side}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${s.bg}`}>
        {s.label && <div className="mb-0.5 text-[10px] font-bold text-gray-500">{s.label}</div>}
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        <div className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-gray-400">
          {error && <span className="text-red-600">⚠️ {error}</span>}
          {time && (
            <span>{new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(new Date(time))}</span>
          )}
        </div>
      </div>
    </div>
  );
}
