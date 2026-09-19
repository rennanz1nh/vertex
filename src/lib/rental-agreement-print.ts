import { RENTAL_AGREEMENT_SECTIONS, RENTAL_AGREEMENT_ACKNOWLEDGMENTS, RENTAL_AGREEMENT_VERSION } from "@/lib/rental-agreement";

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Opens a printable/savable-as-PDF copy of the General Rental Terms in a new tab —
 * available from the Rental Agreement checkout step so a renter can read/keep a copy
 * before (or instead of) signing. Unsigned: it's the contract text itself, not a record
 * of a specific booking, so there's nothing booking-specific to render here.
 */
export function printRentalAgreementTerms(driverName?: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Could not open the print window. Please check your pop-up blocker.");
  }

  const sectionsHtml = RENTAL_AGREEMENT_SECTIONS.map(
    (section) => `
    <div style="margin-bottom:16px; break-inside:avoid;">
      <h3 style="font-size:13px; font-weight:700; color:#111; margin:0 0 4px;">${escapeHtml(section.heading)}</h3>
      ${section.body.map((p) => `<p style="margin:0 0 6px;">${escapeHtml(p)}</p>`).join("")}
      ${
        section.bullets
          ? `<ul style="margin:0 0 6px; padding-left:20px;">${section.bullets
              .map((b) => `<li style="margin-bottom:3px;">${escapeHtml(b)}</li>`)
              .join("")}</ul>`
          : ""
      }
      ${
        section.notice
          ? `<div style="border:1px solid #d97706; background:#fffbeb; padding:8px 10px; border-radius:4px; margin-top:6px;"><strong>${escapeHtml(section.notice)}</strong></div>`
          : ""
      }
    </div>`
  ).join("");

  const ackHtml = RENTAL_AGREEMENT_ACKNOWLEDGMENTS.map((text) => `<li style="margin-bottom:4px;">${escapeHtml(text)}</li>`).join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Vertex Rental Cars — Rental Agreement</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: #fff; color: #1a1a1a; font-size: 12px; line-height: 1.5;
      padding: 40px; max-width: 800px; margin: 0 auto;
    }
    h1 { font-size: 20px; color: #111; margin: 0 0 4px; }
  </style>
</head>
<body>
  <h1>Rental Agreement</h1>
  <p style="color:#555; margin:0 0 24px;">
    Vertex Rental Car USA LLC — General Rental Terms${driverName ? ` &mdash; ${escapeHtml(driverName)}` : ""}
  </p>
  ${sectionsHtml}
  <h3 style="font-size:13px; font-weight:700; color:#111; margin:20px 0 6px;">Renter's express acknowledgments</h3>
  <ul style="margin:0; padding-left:20px;">${ackHtml}</ul>
  <p style="color:#999; font-size:10px; margin-top:24px;">Agreement version: ${escapeHtml(RENTAL_AGREEMENT_VERSION)}</p>
  <div class="no-print" style="text-align:center; margin-top:24px; padding:16px;">
    <button onclick="window.print()" style="padding:10px 24px; font-size:14px; cursor:pointer; border-radius:4px; border:1px solid #ccc; background:#f5f5f5;">Print / Save as PDF</button>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
