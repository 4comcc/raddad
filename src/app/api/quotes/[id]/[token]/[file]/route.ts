import { getQuoteFile } from "@/lib/quotes";

const MIME = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

// Public, unguessable link (random token) so WhatsApp can fetch the document.
export async function GET(_req: Request, ctx: RouteContext<"/api/quotes/[id]/[token]/[file]">) {
  const { id, token } = await ctx.params;
  const q = await getQuoteFile(id, token);
  if (!q) {
    return new Response("Not found", { status: 404 });
  }
  const format = q.format === "xlsx" ? "xlsx" : "pdf";
  return new Response(new Uint8Array(q.file), {
    headers: {
      "Content-Type": MIME[format],
      "Content-Disposition": `inline; filename="quote-${q.number}.${format}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
