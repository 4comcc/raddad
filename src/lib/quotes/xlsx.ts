import "server-only";
import ExcelJS from "exceljs";
import { computeTotals, fetchImage, fmtDate, type QuoteData } from "./types";

const BRAND = "FF047857";

export async function renderQuoteXlsx(q: QuoteData): Promise<Buffer> {
  const images = await Promise.all(q.items.map((i) => fetchImage(i.imageUrl)));
  const hasImages = images.some(Boolean);
  const totals = computeTotals(q.items, q.taxRate);

  const wb = new ExcelJS.Workbook();
  wb.creator = q.business.name;
  wb.created = q.date;
  const ws = wb.addWorksheet("عرض السعر", {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Columns: # | image? | item | qty | unit | total
  const cols = hasImages
    ? [
        { key: "idx", width: 5 },
        { key: "img", width: 11 },
        { key: "item", width: 42 },
        { key: "qty", width: 10 },
        { key: "unit", width: 14 },
        { key: "total", width: 16 },
      ]
    : [
        { key: "idx", width: 5 },
        { key: "item", width: 48 },
        { key: "qty", width: 10 },
        { key: "unit", width: 14 },
        { key: "total", width: 16 },
      ];
  ws.columns = cols;
  const n = cols.length;
  const letter = (k: string) => String.fromCharCode(65 + cols.findIndex((c) => c.key === k));
  const lastCol = String.fromCharCode(64 + n);
  const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Arial", size: 11, ...o });

  // Header
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell("A1").value = q.business.name;
  ws.getCell("A1").font = font({ size: 18, bold: true });
  ws.getRow(1).height = 30;
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell("A2").value = "عرض سعر";
  ws.getCell("A2").font = font({ size: 14, bold: true, color: { argb: BRAND } });
  let r = 3;
  if (q.business.contact) {
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    ws.getCell(`A${r}`).value = q.business.contact;
    ws.getCell(`A${r}`).font = font({ color: { argb: "FF6B7280" } });
    r++;
  }
  r++;
  const meta: [string, string][] = [
    ["رقم العرض", String(q.number)],
    ["التاريخ", fmtDate(q.date)],
    ["صالح حتى", fmtDate(new Date(q.date.getTime() + q.validDays * 86400000))],
    ["العميل", q.customer.name || "—"],
  ];
  if (q.customer.phone && !q.customer.phone.startsWith("sim-")) meta.push(["الهاتف", `+${q.customer.phone}`]);
  for (const [k, v] of meta) {
    ws.getCell(`A${r}`).value = "";
    const kc = ws.getCell(`${letter("item")}${r}`);
    kc.value = `${k}: ${v}`;
    kc.font = font();
    r++;
  }
  r++;

  // Table header
  const headerRow = r;
  const labels: Record<string, string> = {
    idx: "#",
    img: "صورة",
    item: "الصنف",
    qty: "الكمية",
    unit: "سعر الوحدة",
    total: "الإجمالي",
  };
  cols.forEach((c, i) => {
    const cell = ws.getRow(r).getCell(i + 1);
    cell.value = labels[c.key];
    cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(r).height = 22;
  r++;

  const firstItemRow = r;
  q.items.forEach((item, i) => {
    const row = ws.getRow(r);
    row.getCell(letter("idx")).value = i + 1;
    row.getCell(letter("item")).value = item.note ? `${item.name}\n${item.note}` : item.name;
    row.getCell(letter("item")).alignment = { wrapText: true, vertical: "middle" };
    row.getCell(letter("qty")).value = item.quantity;
    row.getCell(letter("unit")).value = item.unitPrice;
    row.getCell(letter("total")).value = {
      formula: `${letter("qty")}${r}*${letter("unit")}${r}`,
      result: item.quantity * item.unitPrice,
    };
    for (const k of ["qty", "unit", "total"]) {
      row.getCell(letter(k)).numFmt = "#,##0.##";
      row.getCell(letter(k)).alignment = { horizontal: "center", vertical: "middle" };
    }
    row.getCell(letter("idx")).alignment = { horizontal: "center", vertical: "middle" };
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.font ?? font();
      c.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
      if (i % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
    });
    row.height = hasImages ? 60 : 24;
    const img = images[i];
    if (img) {
      const id = wb.addImage({ buffer: img as unknown as ExcelJS.Buffer, extension: img[0] === 0x89 ? "png" : "jpeg" });
      const c = cols.findIndex((x) => x.key === "img");
      ws.addImage(id, { tl: { col: c + 0.1, row: r - 1 + 0.1 }, ext: { width: 70, height: 70 } });
    }
    r++;
  });
  const lastItemRow = r - 1;

  // Totals (formulas so the sheet stays editable)
  r++;
  const T = letter("total");
  const labelCol = letter("unit");
  const addTotal = (label: string, formula: string, result: number, strong = false) => {
    const lc = ws.getCell(`${labelCol}${r}`);
    lc.value = label;
    lc.font = font({ bold: strong });
    lc.alignment = { horizontal: "center" };
    const vc = ws.getCell(`${T}${r}`);
    vc.value = { formula, result };
    vc.numFmt = `#,##0.## "${q.currency}"`;
    vc.font = font({ bold: strong, color: strong ? { argb: BRAND } : undefined, size: strong ? 13 : 11 });
    vc.alignment = { horizontal: "center" };
    if (strong) {
      lc.fill = vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
    }
    return r++;
  };
  const subRow = addTotal("المجموع", `SUM(${T}${firstItemRow}:${T}${lastItemRow})`, totals.subtotal);
  let taxRow: number | null = null;
  if (q.taxRate > 0) taxRow = addTotal(`الضريبة ${q.taxRate}%`, `${T}${subRow}*${q.taxRate}/100`, totals.tax);
  addTotal("الإجمالي", taxRow ? `${T}${subRow}+${T}${taxRow}` : `${T}${subRow}`, totals.total, true);

  // Notes / terms
  for (const [title, body] of [
    ["ملاحظات", q.notes],
    ["الشروط", q.terms],
  ] as const) {
    if (!body?.trim()) continue;
    r++;
    ws.getCell(`A${r}`).value = title;
    ws.getCell(`A${r}`).font = font({ bold: true, color: { argb: BRAND } });
    r++;
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    ws.getCell(`A${r}`).value = body;
    ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = Math.min(200, 18 * (body.split("\n").length + Math.ceil(body.length / 90)));
    r++;
  }

  ws.getRow(headerRow).alignment = { horizontal: "center" };
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
