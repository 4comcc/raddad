import "server-only";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import bidiFactory from "bidi-js";
import { computeTotals, fetchImage, fmtDate, money, type QuoteData } from "./types";

const bidi = bidiFactory();
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const REGULAR = fs.readFileSync(path.join(FONT_DIR, "Tajawal-Regular.ttf"));
const BOLD = fs.readFileSync(path.join(FONT_DIR, "Tajawal-Bold.ttf"));

const BRAND = "#047857";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

type Doc = PDFKit.PDFDocument;

/** Split text into direction runs (logical order) using the Unicode bidi algorithm, base RTL. */
function runs(text: string) {
  const { levels } = bidi.getEmbeddingLevels(text, "rtl");
  const out: { text: string; rtl: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const rtl = levels[i] % 2 === 1;
    const last = out[out.length - 1];
    if (last && last.rtl === rtl) last.text += text[i];
    else out.push({ text: text[i], rtl });
  }
  return out;
}

/**
 * Draw one line right-aligned at `right`. Direction runs are placed right-to-left, and words
 * are placed individually (pdfkit drops some inter-word spaces in RTL runs otherwise).
 */
function rtlLine(doc: Doc, text: string, right: number, y: number) {
  const space = doc.widthOfString(" ");
  const tokens = (s: string) => s.split(/( )/).filter((t) => t !== "");
  const draw = (t: string, x: number) => doc.text(t, x, y, { lineBreak: false });
  let x = right;
  for (const r of runs(text)) {
    // Mirror brackets in RTL runs: "(" must render as ")" when glyphs are laid out right-to-left.
    const txt = r.rtl ? [...r.text].map((ch) => bidi.getMirroredCharacter(ch) ?? ch).join("") : r.text;
    const toks = tokens(txt);
    if (r.rtl) {
      for (const t of toks) {
        if (t === " ") x -= space;
        else {
          x -= doc.widthOfString(t);
          draw(t, x);
        }
      }
    } else {
      const widths = toks.map((t) => (t === " " ? space : doc.widthOfString(t)));
      x -= widths.reduce((a, b) => a + b, 0);
      let cx = x;
      toks.forEach((t, i) => {
        if (t !== " ") draw(t, cx);
        cx += widths[i];
      });
    }
  }
  return right - x;
}

function wrap(doc: Doc, text: string, width: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const cand = line ? `${line} ${word}` : word;
      if (doc.widthOfString(cand) <= width || !line) line = cand;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Right-aligned wrapped RTL text block. Returns height used. */
function rtlBlock(doc: Doc, text: string, right: number, y: number, width: number, lineGap = 3) {
  const lh = doc.currentLineHeight() + lineGap;
  const lines = wrap(doc, text, width);
  lines.forEach((l, i) => rtlLine(doc, l, right, y + i * lh));
  return lines.length * lh;
}

/** Left-aligned number/latin text (LTR) inside a cell, right-aligned to `right`. */
function ltrRight(doc: Doc, text: string, right: number, y: number) {
  doc.text(text, right - doc.widthOfString(text), y, { lineBreak: false });
}

export async function renderQuotePdf(q: QuoteData): Promise<Buffer> {
  const images = await Promise.all(q.items.map((i) => fetchImage(i.imageUrl)));
  const hasImages = images.some(Boolean);
  const totals = computeTotals(q.items, q.taxRate);

  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `عرض سعر ${q.number}` } });
  doc.registerFont("r", REGULAR);
  doc.registerFont("b", BOLD);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const L = 40;
  const R = doc.page.width - 40;
  const W = R - L;
  let y = 40;

  // ---- Header ----
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND);
  doc.fillColor("#111827").font("b").fontSize(20);
  rtlLine(doc, q.business.name, R, y);
  doc.font("b").fontSize(16).fillColor(BRAND);
  doc.text("عرض سعر", L, y + 2, { lineBreak: false, features: ["rlig"] });
  y += 32;
  doc.font("r").fontSize(10).fillColor(MUTED);
  if (q.business.contact) {
    y += rtlBlock(doc, q.business.contact, R, y, W / 2);
  }

  // Meta box
  y += 8;
  const boxH = 58;
  doc.roundedRect(L, y, W, boxH, 8).fillAndStroke("#f9fafb", LINE);
  doc.fillColor("#111827").font("r").fontSize(10);
  const meta: [string, string][] = [
    ["رقم العرض", String(q.number)],
    ["التاريخ", fmtDate(q.date)],
    ["صالح حتى", fmtDate(new Date(q.date.getTime() + q.validDays * 86400000))],
  ];
  meta.forEach(([k, v], i) => {
    const yy = y + 10 + i * 15;
    doc.fillColor(MUTED);
    rtlLine(doc, k, R - 12, yy);
    doc.fillColor("#111827");
    ltrRight(doc, v, R - 90, yy);
  });
  doc.fillColor(MUTED);
  rtlLine(doc, "العميل", L + W / 2 - 12, y + 10);
  doc.fillColor("#111827").font("b").fontSize(11);
  rtlLine(doc, q.customer.name || "—", L + W / 2 - 12, y + 26);
  if (q.customer.phone && !q.customer.phone.startsWith("sim-")) {
    doc.font("r").fontSize(10);
    ltrRight(doc, `+${q.customer.phone}`, L + W / 2 - 12, y + 42);
  }
  y += boxH + 18;

  // ---- Table ----
  const imgW = hasImages ? 46 : 0;
  // columns from right to left: #, item, qty, unit price, line total
  const col = {
    idx: { right: R - 8, w: 22 },
    item: { right: R - 34, w: W - 34 - 70 - 90 - 95 - 8 },
    qty: { right: L + 95 + 90 + 70 - 8, w: 62 },
    unit: { right: L + 95 + 90 - 8, w: 82 },
    total: { right: L + 95 - 8, w: 87 },
  };
  const header = () => {
    doc.rect(L, y, W, 24).fill(BRAND);
    doc.fillColor("#ffffff").font("b").fontSize(10);
    rtlLine(doc, "#", col.idx.right, y + 7);
    rtlLine(doc, "الصنف", col.item.right, y + 7);
    rtlLine(doc, "الكمية", col.qty.right, y + 7);
    rtlLine(doc, "سعر الوحدة", col.unit.right, y + 7);
    rtlLine(doc, "الإجمالي", col.total.right, y + 7);
    y += 24;
  };
  header();

  q.items.forEach((item, i) => {
    doc.font("r").fontSize(10);
    const textW = col.item.w - imgW - (imgW ? 8 : 0);
    const nameLines = wrap(doc, item.name, textW);
    const noteLines = item.note ? wrap(doc, item.note, textW) : [];
    const lh = doc.currentLineHeight() + 3;
    const rowH = Math.max(28, (nameLines.length + noteLines.length) * lh + 12, imgW ? imgW + 10 : 0);
    if (y + rowH > doc.page.height - 160) {
      doc.addPage();
      y = 40;
      header();
    }
    if (i % 2 === 1) doc.rect(L, y, W, rowH).fill("#f9fafb");
    doc.fillColor("#111827").font("r").fontSize(10);
    const ty = y + 6;
    ltrRight(doc, String(i + 1), col.idx.right, ty);
    const img = images[i];
    if (img) {
      try {
        doc.image(img, col.item.right - imgW, y + 5, { fit: [imgW, imgW], align: "center", valign: "center" });
      } catch {
        /* unsupported image */
      }
    }
    const textRight = col.item.right - (imgW ? imgW + 8 : 0);
    doc.font("b");
    nameLines.forEach((l, k) => rtlLine(doc, l, textRight, ty + k * lh));
    doc.font("r").fillColor(MUTED);
    noteLines.forEach((l, k) => rtlLine(doc, l, textRight, ty + (nameLines.length + k) * lh));
    doc.fillColor("#111827");
    ltrRight(doc, money(item.quantity), col.qty.right, ty);
    ltrRight(doc, money(item.unitPrice), col.unit.right, ty);
    doc.font("b");
    ltrRight(doc, money(item.quantity * item.unitPrice), col.total.right, ty);
    y += rowH;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
  });

  // ---- Totals ----
  y += 14;
  const tW = 230;
  const tL = L;
  const rows: [string, string, boolean][] = [["المجموع", money(totals.subtotal), false]];
  if (q.taxRate > 0) rows.push([`الضريبة ${q.taxRate}%`, money(totals.tax), false]);
  rows.push(["الإجمالي", `${money(totals.total)} ${q.currency}`, true]);
  rows.forEach(([k, v, strong]) => {
    if (strong) doc.roundedRect(tL, y - 4, tW, 26, 6).fill("#ecfdf5");
    doc.font(strong ? "b" : "r").fontSize(strong ? 13 : 10.5).fillColor(strong ? BRAND : "#111827");
    rtlLine(doc, k, tL + tW - 10, y + (strong ? 2 : 0));
    ltrRight(doc, v, tL + 110, y + (strong ? 2 : 0));
    y += strong ? 30 : 20;
  });

  // ---- Notes & terms ----
  doc.font("r").fontSize(10).fillColor("#111827");
  const blocks: [string, string | undefined][] = [
    ["ملاحظات", q.notes],
    ["الشروط", q.terms],
  ];
  for (const [title, body] of blocks) {
    if (!body?.trim()) continue;
    if (y > doc.page.height - 140) {
      doc.addPage();
      y = 40;
    }
    y += 8;
    doc.font("b").fillColor(BRAND);
    rtlLine(doc, title, R, y);
    y += 18;
    doc.font("r").fillColor("#374151");
    y += rtlBlock(doc, body, R, y, W);
  }

  // Footer
  doc.font("r").fontSize(8).fillColor(MUTED);
  const footer = "تم إنشاء هذا العرض آليًا — الأسعار حسب المتاح وقت الإصدار";
  rtlLine(doc, footer, R, doc.page.height - 50);

  doc.end();
  return done;
}
