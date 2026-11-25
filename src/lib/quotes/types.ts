export type QuoteItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string;
  imageUrl?: string;
};

export type QuoteData = {
  number: number;
  date: Date;
  validDays: number;
  business: { name: string; contact?: string };
  customer: { name?: string; phone?: string };
  currency: string;
  taxRate: number; // percent, e.g. 15
  items: QuoteItem[];
  notes?: string;
  terms?: string;
};

export type QuoteTotals = { subtotal: number; tax: number; total: number };

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(items: QuoteItem[], taxRate: number): QuoteTotals {
  const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const tax = round2((subtotal * taxRate) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/** Fetch a product image for embedding (JPEG/PNG only, small, with timeout). */
export async function fetchImage(url?: string): Promise<Buffer | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isJpeg || isPng ? buf : null;
  } catch {
    return null;
  }
}
