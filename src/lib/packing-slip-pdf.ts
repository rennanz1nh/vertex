import html2canvas from "html2canvas";
import { COMPANY } from "@/lib/invoice-pdf";
import { getCarrierLogo } from "@/lib/carrier-utils";

const logoUrl = "/images/admin-logo.png";
const wordmarkLogoUrl = "/images/store-logo-sidebar.png";

// Local logo assets only (no external URLs) — html2canvas needs same-origin images to
// render reliably without CORS headaches.
const CHANNEL_LOGOS: Record<string, string> = {
  Amazon: "/images/sales-channels/Amazon.png",
  eBay: "/images/sales-channels/Ebay.png",
  Etsy: "/images/sales-channels/Etsy.png",
  TikTok: "/images/sales-channels/TikTok.png",
  "Vertex Rental Cars": "/images/sales-channels/Vertex_Rental_Cars.png",
  Zelle: "/images/sales-channels/Zelle.png",
  WhatsApp: "/images/sales-channels/Whatsapp.png",
};

export interface PackingSlipItem {
  sku?: string | null;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  imageUrl?: string | null;
}

export interface PackingSlipData {
  clientName: string;
  clientAddress?: string;
  clientContact?: string;
  orderDate?: string | Date;
  orderNumber?: string;
  channel?: string | null;
  items: PackingSlipItem[];
  taxes?: number | null;
  shippingFee?: number | null;
  total?: number | null;
  shippingTracking?: string | null;
  carrier?: string | null;
  service?: string | null;
}

function generateSlipNumber(): string {
  const ts = Date.now().toString().slice(-7);
  const rnd = Math.floor(100 + Math.random() * 900);
  return `${ts}${rnd}`;
}

const fmtDate = (d?: string | Date) => {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtMoney = (v: number) =>
  `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildHtml(data: PackingSlipData, slipNumber: string): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: 816px; padding: 48px; background: #fff; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 12px; line-height: 1.4;
  `;

  const itemsRows = data.items
    .map((it) => {
      const lineTotal = (it.unitPrice ?? 0) * it.quantity;
      return `
      <tr style="border-bottom:1px solid #e5e5e5;">
        <td style="padding:10px 8px; vertical-align:middle; font-weight:600;">${escapeHtml(it.sku || "—")}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:center; width:64px;">
          ${it.imageUrl ? `<img src="${escapeHtml(it.imageUrl)}" crossorigin="anonymous" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" />` : ""}
        </td>
        <td style="padding:10px 8px; vertical-align:middle;">${escapeHtml(it.name)}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:center; font-weight:600;">${it.quantity}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:right;">${it.unitPrice != null ? fmtMoney(it.unitPrice) : "—"}</td>
        <td style="padding:10px 8px; vertical-align:middle; text-align:right; font-weight:600;">${it.unitPrice != null ? fmtMoney(lineTotal) : "—"}</td>
      </tr>`;
    })
    .join("");

  const subtotal = data.items.reduce((s, it) => s + (it.unitPrice ?? 0) * it.quantity, 0);
  const taxRow =
    data.taxes && data.taxes > 0
      ? `<tr><td style="padding:4px 0; text-align:right; color:#555;">Taxes:</td><td style="padding:4px 0 4px 24px; text-align:right; min-width:100px;">${fmtMoney(data.taxes)}</td></tr>`
      : "";
  const shippingRow =
    data.shippingFee && data.shippingFee > 0
      ? `<tr><td style="padding:4px 0; text-align:right; color:#555;">Shipping Fee:</td><td style="padding:4px 0 4px 24px; text-align:right; min-width:100px;">${fmtMoney(data.shippingFee)}</td></tr>`
      : "";
  const grandTotal = data.total ?? subtotal + (data.taxes ?? 0) + (data.shippingFee ?? 0);
  const totalsBlock = `
    <div style="display:flex; justify-content:flex-end; margin-top:8px;">
      <table style="min-width:280px;">
        <tr><td style="padding:4px 0; text-align:right; color:#555;">Subtotal:</td><td style="padding:4px 0 4px 24px; text-align:right; min-width:100px;">${fmtMoney(subtotal)}</td></tr>
        ${taxRow}
        ${shippingRow}
        <tr style="border-top:2px solid #111;"><td style="padding:8px 0 0; text-align:right; font-weight:700; font-size:14px; color:#111;">Total:</td><td style="padding:8px 0 0 24px; text-align:right; font-weight:700; font-size:14px; color:#111;">${fmtMoney(grandTotal)}</td></tr>
      </table>
    </div>`;

  const paymentBlock = `
    <div style="margin-top:32px;">
      <div style="font-size:14px; font-weight:700; color:#111; margin-bottom:8px; border-bottom:1px solid #e5e5e5; padding-bottom:6px;">Payment details</div>
      <div style="display:flex; gap:24px; font-size:13px; color:#333;">
        <span>${fmtDate(data.orderDate)}</span>
        <span>${escapeHtml(data.channel || "—")}</span>
        <span style="font-weight:600;">${fmtMoney(grandTotal)}</span>
      </div>
    </div>`;

  const channelLogo = data.channel ? CHANNEL_LOGOS[data.channel] : null;
  const channelBlock = data.channel
    ? `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:24px; padding:12px 16px; background:#fafafa; border-radius:6px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888;">Sold via</div>
      ${channelLogo ? `<img src="${channelLogo}" crossorigin="anonymous" style="height:22px; width:auto; object-fit:contain;" />` : ""}
      <span style="font-size:13px; font-weight:600; color:#111;">${escapeHtml(data.channel)}</span>
    </div>`
    : "";

  const carrierLogo = data.carrier ? getCarrierLogo(data.carrier, data.shippingTracking) : null;
  const shippingBlock =
    data.shippingTracking && data.shippingTracking.trim()
      ? `
      <div style="margin-top:24px; padding:14px 16px; background:#f7f7f9; border-left:4px solid #111; border-radius:4px;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#777; margin-bottom:8px;">Shipping Information</div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
          ${carrierLogo ? `<img src="${carrierLogo}" crossorigin="anonymous" style="height:20px; width:auto; object-fit:contain;" />` : ""}
          <strong style="font-size:13px;">${escapeHtml(data.carrier || "—")}</strong>
        </div>
        <div style="font-size:13px;"><strong>Tracking #:</strong> ${escapeHtml(data.shippingTracking)}</div>
        ${data.service ? `<div style="font-size:13px;"><strong>Service:</strong> ${escapeHtml(data.service)}</div>` : ""}
      </div>`
      : "";

  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
      <img src="${logoUrl}" crossorigin="anonymous" style="width:140px; height:auto;" />
      <div style="text-align:right;">
        <div style="font-size:24px; font-weight:700; color:#111;">PACKING SLIP</div>
        <div style="font-size:14px; color:#555; margin-top:4px;">Order #${escapeHtml(data.orderNumber || slipNumber)}</div>
        <div style="font-size:12px; color:#888; margin-top:2px;">${fmtDate(data.orderDate)}</div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; gap:32px; margin-bottom:28px;">
      <div style="flex:1;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px;">Ship to</div>
        <div style="font-size:14px; font-weight:700; color:#111;">${escapeHtml(data.clientName || "—")}</div>
        ${data.clientAddress ? `<div style="margin-top:4px; color:#555;">${escapeHtml(data.clientAddress)}</div>` : ""}
        ${data.clientContact ? `<div style="color:#555;">${escapeHtml(data.clientContact)}</div>` : ""}
      </div>
      <div style="flex:1; text-align:right;">
        <div style="font-weight:700; color:#111; font-size:13px;">${COMPANY.name}</div>
        <div style="color:#555; margin-top:2px;">${COMPANY.address}</div>
        <div style="color:#555;">${COMPANY.email}</div>
      </div>
    </div>

    ${channelBlock}

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
      <thead>
        <tr style="background:#f5f5f5; border-bottom:2px solid #ccc;">
          <th style="padding:10px 8px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">SKU</th>
          <th style="padding:10px 8px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Image</th>
          <th style="padding:10px 8px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Product</th>
          <th style="padding:10px 8px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Qty</th>
          <th style="padding:10px 8px; text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Price</th>
          <th style="padding:10px 8px; text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    ${totalsBlock}

    ${shippingBlock}

    ${paymentBlock}

    <div style="margin-top:48px; text-align:center;">
      <img src="${wordmarkLogoUrl}" alt="Vertex Rental Cars" crossorigin="anonymous" style="height:28px; width:auto; margin:0 auto 10px; display:block;" />
      <div style="color:#999; font-style:italic; font-size:11px;">
        Thanks for buying with us
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

async function waitForImages(node: HTMLDivElement) {
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
}

/** Opens the browser print dialog for the packing slip (matches printInvoice's pattern). */
export async function printPackingSlip(data: PackingSlipData): Promise<string> {
  // Open the window synchronously, before any `await` — most browsers only allow
  // window.open() while still inside the original click's call stack; opening it after
  // an async gap (e.g. waiting for images) gets silently blocked as a popup.
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
  }

  const number = generateSlipNumber();
  const node = buildHtml(data, number);
  try {
    await waitForImages(node);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Packing Slip #${data.orderNumber || number}</title>
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
    <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; border-radius:4px; border:1px solid #ccc; background:#f5f5f5;">Print Packing Slip</button>
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

/** Downloads the packing slip as a PDF instead of printing it directly. */
export async function generatePackingSlipPDF(data: PackingSlipData): Promise<string> {
  const { default: jsPDF } = await import("jspdf");
  const number = generateSlipNumber();
  const node = buildHtml(data, number);
  try {
    await waitForImages(node);
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    pdf.save(`Packing-Slip-${data.orderNumber || number}.pdf`);
    return number;
  } finally {
    node.remove();
  }
}
