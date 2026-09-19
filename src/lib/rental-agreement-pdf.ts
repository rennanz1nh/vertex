import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { RENTAL_AGREEMENT_SECTIONS, RENTAL_AGREEMENT_ACKNOWLEDGMENTS } from "@/lib/rental-agreement";

const logoUrl = "/images/admin-logo.png";

export interface RentalAgreementPdfData {
  bookingId: string;
  carName: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  driverFullName: string;
  driverDateOfBirth: string;
  driverLicenseNumber: string;
  driverLicenseState: string;
  driverLicenseExpiration: string;
  signedAt: string;
  agreementVersion: string | null;
  signatureUrl: string;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Fetched and inlined as a data URL rather than referenced by its (cross-origin, signed)
// Supabase Storage URL — html2canvas taints the canvas on a cross-origin image unless the
// response sends permissive CORS headers, and a signed URL is one more thing that could
// silently break that. A data: URI sidesteps the whole question.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildHtml(data: RentalAgreementPdfData, signatureDataUrl: string | null): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: 816px; padding: 48px; background: #fff; color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 11px; line-height: 1.5;
  `;

  const clausesHtml = RENTAL_AGREEMENT_SECTIONS.map(
    (section) => `
    <div style="margin-bottom:12px; break-inside:avoid;">
      <div style="font-size:11.5px; font-weight:700; margin-bottom:3px;">${escapeHtml(section.heading)}</div>
      ${section.body.map((p) => `<p style="margin:0 0 4px;">${escapeHtml(p)}</p>`).join("")}
      ${
        section.bullets
          ? `<ul style="margin:0 0 4px; padding-left:18px;">${section.bullets
              .map((b) => `<li style="margin-bottom:2px;">${escapeHtml(b)}</li>`)
              .join("")}</ul>`
          : ""
      }
      ${
        section.notice
          ? `<div style="border:1px solid #d97706; background:#fffbeb; padding:6px 8px; border-radius:4px; margin-top:4px;"><strong>${escapeHtml(section.notice)}</strong></div>`
          : ""
      }
    </div>`
  ).join("");

  const ackHtml = RENTAL_AGREEMENT_ACKNOWLEDGMENTS.map(
    (text) => `
    <div style="display:flex; gap:6px; margin-bottom:4px;">
      <span style="flex-shrink:0;">&#9745;</span>
      <span>${escapeHtml(text)}</span>
    </div>`
  ).join("");

  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
      <img src="${logoUrl}" crossorigin="anonymous" style="width:130px; height:auto;" />
      <div style="text-align:right;">
        <div style="font-size:20px; font-weight:700; color:#111;">RENTAL AGREEMENT</div>
        <div style="font-size:12px; color:#555; margin-top:2px;">Confirmation #${escapeHtml(data.bookingId.slice(0, 8).toUpperCase())}</div>
      </div>
    </div>

    <div style="display:flex; gap:24px; margin-bottom:20px; padding:12px 16px; background:#f9fafb; border-radius:6px;">
      <div style="flex:1;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.5px; color:#888; margin-bottom:4px;">Renter</div>
        <div style="font-weight:700; color:#111;">${escapeHtml(data.driverFullName)}</div>
        <div style="color:#555; margin-top:2px;">DOB: ${escapeHtml(data.driverDateOfBirth)}</div>
        <div style="color:#555;">License: ${escapeHtml(data.driverLicenseNumber)} (${escapeHtml(data.driverLicenseState)})</div>
        <div style="color:#555;">Expires: ${escapeHtml(data.driverLicenseExpiration)}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.5px; color:#888; margin-bottom:4px;">Vehicle &amp; Trip</div>
        <div style="font-weight:700; color:#111;">${escapeHtml(data.carName)}</div>
        <div style="color:#555; margin-top:2px;">Pick-up: ${escapeHtml(data.pickupDate)} at ${escapeHtml(data.pickupTime)}</div>
        <div style="color:#555;">Return: ${escapeHtml(data.returnDate)} at ${escapeHtml(data.returnTime)}</div>
      </div>
    </div>

    <div style="font-size:13px; font-weight:700; color:#111; margin-bottom:10px; border-bottom:2px solid #111; padding-bottom:4px;">
      Vertex Rental Car USA LLC &mdash; General Rental Terms
    </div>
    ${clausesHtml}

    <div style="font-size:11px; font-weight:700; color:#111; margin:16px 0 6px;">Renter's express acknowledgments</div>
    ${ackHtml}

    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #ddd; display:flex; justify-content:space-between; align-items:flex-end;">
      <div>
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.5px; color:#888; margin-bottom:4px;">Renter signature</div>
        ${
          signatureDataUrl
            ? `<img src="${signatureDataUrl}" style="width:180px; height:90px; object-fit:contain; border:1px solid #ddd; border-radius:4px; background:#fff;" />`
            : `<div style="width:180px; height:90px; border:1px solid #ddd; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#999; font-size:10px;">Signature unavailable</div>`
        }
        <div style="color:#555; margin-top:4px;">${escapeHtml(data.driverFullName)} &mdash; signed ${escapeHtml(data.signedAt)}</div>
      </div>
      <div style="text-align:right; color:#999;">
        Agreement version: ${escapeHtml(data.agreementVersion || "—")}
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

export async function downloadRentalAgreementPdf(data: RentalAgreementPdfData): Promise<void> {
  const signatureDataUrl = await toDataUrl(data.signatureUrl);
  const node = buildHtml(data, signatureDataUrl);
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

    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgWidth, imgHeight);
    } else {
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
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgWidth, (sliceHeight * imgWidth) / canvas.width);
        offset += sliceHeight;
        remaining -= sliceHeight;
      }
    }

    pdf.save(`Rental-Agreement-${data.bookingId.slice(0, 8).toUpperCase()}.pdf`);
  } finally {
    node.remove();
  }
}
