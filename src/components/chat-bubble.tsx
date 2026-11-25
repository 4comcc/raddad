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
  mediaUrl,
  mediaType,
  fileName,
}: {
  role: keyof typeof STYLE;
  text: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  fileName?: string | null;
  time?: Date | string;
  error?: string | null;
}) {
  const s = STYLE[role];
  return (
    <div className={`flex ${s.side}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${s.bg}`}>
        {s.label && <div className="mb-0.5 text-[10px] font-bold text-gray-500">{s.label}</div>}
        {mediaUrl && mediaType === "document" ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex items-center gap-3 rounded-xl bg-white/70 p-3 hover:bg-white"
          >
            <span className="text-2xl">{fileName?.endsWith(".xlsx") ? "📊" : "📄"}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-800" dir="auto">
                {fileName ?? "ملف"}
              </span>
              <span className="block text-[11px] text-gray-500">اضغط للفتح أو التحميل</span>
            </span>
          </a>
        ) : (
          mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="mb-1 max-h-60 w-full rounded-xl object-cover" loading="lazy" />
          )
        )}
        {text && <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
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
