const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

export function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "";
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "الآن";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function formatDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

export function maskPhone(p: string) {
  if (p.startsWith("sim-")) return "محاكي";
  return p.length > 6 ? `+${p.slice(0, 4)}•••${p.slice(-3)}` : p;
}

export const LEAD_LABEL = { ORDER: "طلب", BOOKING: "حجز", INQUIRY: "استفسار" } as const;
export const LEAD_STATUS_LABEL = { NEW: "جديد", DONE: "تم", CANCELLED: "ملغي" } as const;

export function isWithin24h(d: Date | string | null | undefined) {
  return Boolean(d) && Date.now() - new Date(d!).getTime() < 24 * 3600 * 1000;
}
