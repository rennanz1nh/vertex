import jsPDF from "jspdf";
import html2canvas from "html2canvas";
const logoUrl = "/images/admin-logo.png";

export interface InvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  amount: number;
  imageUrl?: string;
}

export interface InvoiceData {
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  clientAddress?: string;
  orderDate?: string | Date;
  orderNumber?: string;
  channel?: string;
  items: InvoiceItem[];
  salesTax: number;
  shipping?: number;
  total: number;
  shippingTracking?: string;
  carrier?: string;
}

export type InvoiceFormat = "pdf" | "jpeg";

export const COMPANY = {
  name: "Vertex Rental Cars",
  address: "4385 Pebbles Throw Drive, Kissimme - FL 34746",
  email: "contact@vertexrentalcars.com",
};

export function generateInvoiceNumber(): string {
  const ts = Date.now().toString().slice(-7);
  const rnd = Math.floor(100 + Math.random() * 900);
  return `${ts}${rnd}`;
}

const fmt = (v: number) =>
  `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | Date) => {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
};

function buildHtml(data: InvoiceData, invoiceNumber: string): HTMLDivElement {
  const subtotal = data.items.reduce((s, it) => s + it.amount, 0);
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: 816px; padding: 48px; background: #fff; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 12px; line-height: 1.4;
  `;

  const itemsRows = data.items
    .map(
      (it) => `
      <tr style="border-bottom:1px solid #e5e5e5;">
        <td style="padding:10px 8px; vertical-align:middle; font-weight:600;">${escapeHtml(it.sku || "—")}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:center; width:64px;">
          ${it.imageUrl ? `<img src="${escapeAttr(it.imageUrl)}" crossorigin="anonymous" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" />` : ""}
        </td>
        <td style="padding:10px 8px; vertical-align:middle;">${escapeHtml(it.name)}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:center;">${it.quantity}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:right; font-weight:600;">${fmt(it.amount)}</td>
      </tr>`
    )
    .join("");

  const shippingRow =
    data.shipping && data.shipping > 0
      ? `<tr><td style="padding:4px 0; text-align:right; color:#555;">Shipping:</td><td style="padding:4px 0; text-align:right; min-width:100px;">${fmt(data.shipping)}</td></tr>`
      : "";
  const taxRow =
    data.salesTax && data.salesTax > 0
      ? `<tr><td style="padding:4px 0; text-align:right; color:#555;">Sales Tax:</td><td style="padding:4px 0 4px 24px; text-align:right;">${fmt(data.salesTax)}</td></tr>`
      : "";

  const trackingBlock =
    data.shippingTracking && data.shippingTracking.trim()
      ? `
      <div style="margin-top:32px; padding:14px 16px; background:#f7f7f9; border-left:4px solid #111; border-radius:4px;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#777; margin-bottom:4px;">Shipping Information</div>
        <div style="font-size:13px;"><strong>Carrier:</strong> ${escapeHtml(data.carrier || "—")}</div>
        <div style="font-size:13px;"><strong>Tracking #:</strong> ${escapeHtml(data.shippingTracking)}</div>
      </div>`
      : "";

  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
      <img src="${logoUrl}" crossorigin="anonymous" style="width:140px; height:auto;" />
      <div style="text-align:right;">
        <div style="font-size:24px; font-weight:700; color:#111;">INVOICE</div>
        <div style="font-size:14px; color:#555; margin-top:4px;">#${invoiceNumber}</div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; gap:32px; margin-bottom:28px;">
      <div style="flex:1;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px;">Bill To</div>
        <div style="font-size:14px; font-weight:700; color:#111;">${escapeHtml(data.clientName || "—")}</div>
        ${data.clientAddress ? `<div style="margin-top:4px; color:#555;">${escapeHtml(data.clientAddress)}</div>` : ""}
        ${data.clientContact ? `<div style="color:#555;">${escapeHtml(data.clientContact)}</div>` : ""}
        ${data.clientEmail ? `<div style="color:#555;">${escapeHtml(data.clientEmail)}</div>` : ""}
      </div>
      <div style="flex:1; text-align:right;">
        <div style="font-weight:700; color:#111; font-size:13px;">${COMPANY.name}</div>
        <div style="color:#555; margin-top:2px;">${COMPANY.address}</div>
        <div style="color:#555;">${COMPANY.email}</div>
      </div>
    </div>

    <div style="display:flex; gap:16px; margin-bottom:24px; padding:12px 16px; background:#fafafa; border-radius:6px;">
      <div style="flex:1;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888;">Order Date</div>
        <div style="font-size:13px; font-weight:600; color:#111;">${fmtDate(data.orderDate)}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888;">Order #</div>
        <div style="font-size:13px; font-weight:600; color:#111;">${escapeHtml(data.orderNumber || "—")}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888;">Channel</div>
        <div style="font-size:13px; font-weight:600; color:#111;">${escapeHtml(data.channel || "—")}</div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
      <thead>
        <tr style="background:#f5f5f5; border-bottom:2px solid #ccc;">
          <th style="padding:10px 8px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">#ID (SKU)</th>
          <th style="padding:10px 8px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Image</th>
          <th style="padding:10px 8px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Description</th>
          <th style="padding:10px 8px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Qty</th>
          <th style="padding:10px 8px; text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div style="display:flex; justify-content:flex-end; margin-top:8px;">
      <table style="min-width:280px;">
        <tr><td style="padding:4px 0; text-align:right; color:#555;">Subtotal:</td><td style="padding:4px 0 4px 24px; text-align:right; min-width:100px;">${fmt(subtotal)}</td></tr>
        ${shippingRow}
        ${taxRow}
        <tr style="border-top:2px solid #111;"><td style="padding:8px 0 0; text-align:right; font-weight:700; font-size:14px; color:#111;">Total:</td><td style="padding:8px 0 0 24px; text-align:right; font-weight:700; font-size:14px; color:#111;">${fmt(data.total)}</td></tr>
      </table>
    </div>

    ${trackingBlock}

    <div style="margin-top:48px; text-align:center; color:#999; font-style:italic; font-size:11px;">
      Thank you for your business!
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export async function generateInvoice(
  data: InvoiceData,
  format: InvoiceFormat = "pdf",
  invoiceNumber?: string
): Promise<string> {
  const number = invoiceNumber || generateInvoiceNumber();
  const node = buildHtml(data, number);
  try {
    // Wait for images to load
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    if (format === "jpeg") {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      triggerDownload(dataUrl, `Invoice-${number}.jpg`);
    } else {
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      } else {
        // Multi-page: slice the canvas
        let remaining = canvas.height;
        let offset = 0;
        const pageCanvasHeight = (canvas.width * pageHeight) / pageWidth;
        let first = true;
        while (remaining > 0) {
          const sliceHeight = Math.min(pageCanvasHeight, remaining);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceHeight;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          const sliceData = slice.toDataURL("image/jpeg", 0.92);
          if (!first) pdf.addPage();
          first = false;
          pdf.addImage(sliceData, "JPEG", 0, 0, imgWidth, (sliceHeight * imgWidth) / canvas.width);
          offset += sliceHeight;
          remaining -= sliceHeight;
        }
      }
    pdf.save(`Invoice-${number}.pdf`);
    }
    return number;
  } finally {
    node.remove();
  }
}

export async function printInvoice(
  data: InvoiceData,
  invoiceNumber?: string
): Promise<string> {
  const number = invoiceNumber || generateInvoiceNumber();
  const node = buildHtml(data, number);
  try {
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice #${number}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: #fff; color: #1a1a1a; font-size: 12px; line-height: 1.4; padding: 48px; max-width: 816px; margin: 0 auto; }
  </style>
</head>
<body>
  ${node.innerHTML}
  <div class="no-print" style="text-align:center; margin-top:24px; padding:16px;">
    <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; border-radius:4px; border:1px solid #ccc; background:#f5f5f5;">Imprimir Invoice</button>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    return number;
  } finally {
    node.remove();
  }
}

// Backwards-compatible
export const generateInvoicePDF = (data: InvoiceData, invoiceNumber?: string) =>
  generateInvoice(data, "pdf", invoiceNumber);
