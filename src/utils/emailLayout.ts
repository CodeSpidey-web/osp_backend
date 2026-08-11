// ============================================================================
// CENTRALIZED BRANDED EMAIL LAYOUT
// Ocean Student Projects - Shared master template, theme, helpers
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Brand Configuration (colors, logo, social, URLs)
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "Ocean Student Projects",
  shortName: "Ocean Student Projects",

  colors: {
    navy: "#0b2545",
    green: "#136c39",
    greenLight: "#22c55e",
    gold: "#fed000",
    orange: "#eb7f23",
    white: "#ffffff",
    bgOuter: "#f8fafc",
    bgCard: "#ffffff",
    textPrimary: "#0b2545",
    textBody: "#334155",
    textMuted: "#64748b",
    borderSoft: "#e2e8f0",
    tableHeaderBg: "#f8fafc",
    accentCardBg: "#f8fafc",
    accentCardBorder: "#e2e8f0",
  },

  typography: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  contact: {
    phone: "+91 904 268 6793",
    phoneHref: "+919042686793",
    addressLine1: "No. 12, Shop No. 7, Narasingapuram Street, (Jothi Lodge Building), Mount Road",
    addressLine2: "Chennai – 600 002, Tamil Nadu, India",
    supportEmail: "oceanstudentprojects@gmail.com",
  },

  social: [
    {
      name: "Facebook",
      url: "https://www.facebook.com/profile.php?id=61576958505445",
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/ocean_student_projects?utm_source=qr&igsh=eWdnNXd5aHY0OHRi",
    },
    {
      name: "YouTube",
      url: "https://www.youtube.com/@OceanStudentProjects-r1p",
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. URL helpers
// ---------------------------------------------------------------------------

export function getStorefrontUrl(): string {
  return (process.env.STOREFRONT_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getBackendUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// 3. HTML helpers
// ---------------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// 4. Shared inner content primitives
// ---------------------------------------------------------------------------

export interface EmailButtonOptions {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "orange";
}

export function renderButton(opts: EmailButtonOptions): string {
  const variant = opts.variant || "primary";
  let bg = BRAND.colors.green;
  let border = BRAND.colors.green;
  if (variant === "orange") {
    bg = BRAND.colors.orange;
    border = BRAND.colors.orange;
  } else if (variant === "secondary") {
    bg = BRAND.colors.navy;
    border = BRAND.colors.navy;
  }
  const safeHref = escapeHtml(opts.href);
  const safeLabel = escapeHtml(opts.label);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 20px auto; display: inline-block;">
      <tbody>
        <tr>
          <td style="border-radius: 6px; background: ${bg}; border: 1px solid ${border};">
            <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 12px 28px; font-family: ${BRAND.typography.family}; font-size: 14px; font-weight: 700; color: ${BRAND.colors.white}; text-decoration: none; border-radius: 6px; letter-spacing: 0.01em;">
              ${safeLabel}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

export function renderGradientHeading(text: string, sizePx = 22): string {
  const safe = escapeHtml(text);
  return `
    <h2 style="margin: 0 0 8px 0; font-family: ${BRAND.typography.family}; font-size: ${sizePx}px; font-weight: 700; line-height: 1.3; color: ${BRAND.colors.navy}; text-align: center;">
      ${safe}
    </h2>
  `;
}

export function renderSummaryCard(
  title: string,
  rows: Array<[string, string]>,
  iconEmoji = "📋"
): string {
  const rowsHtml = rows
    .map(([label, value]) => {
      return `
        <p style="margin: 6px 0; color: ${BRAND.colors.textBody}; font-size: 13px; line-height: 1.5; font-family: ${BRAND.typography.family};">
          <strong style="color: ${BRAND.colors.navy}; display: inline-block; min-width: 110px;">${escapeHtml(label)}:</strong>
          ${value}
        </p>
      `;
    })
    .join("");

  return `
    <div style="background: ${BRAND.colors.accentCardBg}; border: 1px solid ${BRAND.colors.accentCardBorder}; padding: 16px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: ${BRAND.colors.navy}; font-size: 14px; font-weight: 700; font-family: ${BRAND.typography.family};">
        ${iconEmoji} ${escapeHtml(title)}
      </p>
      ${rowsHtml}
    </div>
  `;
}

export interface OrderItemRow {
  title: string;
  quantity: number | string;
  amount: string;
}

export function renderOrderItemsTable(items: OrderItemRow[]): string {
  const rows = items.length
    ? items
        .map((it) => {
          return `
            <tr style="border-bottom: 1px solid ${BRAND.colors.borderSoft};">
              <td style="padding: 10px 0; font-family: ${BRAND.typography.family}; color: ${BRAND.colors.textPrimary}; font-size: 14px;">${escapeHtml(it.title)}</td>
              <td style="padding: 10px 0; text-align: center; font-family: ${BRAND.typography.family}; color: ${BRAND.colors.textMuted}; font-size: 14px;">${escapeHtml(it.quantity)}</td>
              <td style="padding: 10px 0; text-align: right; font-family: ${BRAND.typography.family}; color: ${BRAND.colors.textPrimary}; font-size: 14px;">${escapeHtml(it.amount)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: ${BRAND.colors.textMuted}; font-size: 13px;">No items listed</td></tr>`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-family: ${BRAND.typography.family};">
      <thead>
        <tr style="border-bottom: 2px solid ${BRAND.colors.borderSoft}; text-align: left; background: ${BRAND.colors.tableHeaderBg};">
          <th style="padding: 10px 8px; color: ${BRAND.colors.navy}; font-weight: 600; font-size: 13px;">Product</th>
          <th style="padding: 10px 8px; text-align: center; color: ${BRAND.colors.navy}; font-weight: 600; font-size: 13px;">Qty</th>
          <th style="padding: 10px 8px; text-align: right; color: ${BRAND.colors.navy}; font-weight: 600; font-size: 13px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

export interface TotalsRow {
  label: string;
  value: string;
  bold?: boolean;
  highlighted?: boolean;
}

export function renderTotalsTable(rows: TotalsRow[]): string {
  const rowsHtml = rows
    .map((r) => {
      const borderTop = r.highlighted ? `border-top: 2px solid ${BRAND.colors.borderSoft};` : "";
      const valueColor = r.highlighted ? BRAND.colors.green : BRAND.colors.textPrimary;
      const size = r.highlighted ? "16px" : "14px";
      const paddingTop = r.highlighted ? "12px 0 0 0" : "6px 0";
      const weight = r.bold || r.highlighted ? "700" : "400";
      return `
        <tr>
          <td style="padding: ${paddingTop}; color: ${BRAND.colors.textBody}; font-size: 14px; width: 60%; font-family: ${BRAND.typography.family};">${escapeHtml(r.label)}</td>
          <td style="padding: ${paddingTop}; ${borderTop} text-align: right; color: ${valueColor}; font-weight: ${weight}; font-size: ${size}; font-family: ${BRAND.typography.family};">${escapeHtml(r.value)}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: ${BRAND.typography.family};">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// 5. Master Email Layout - renderBrandedEmail()
// ---------------------------------------------------------------------------

export interface RenderEmailOptions {
  previewText?: string;
  body: string;
  heroEmoji?: string;
  heroHeading?: string;
  heroSubheading?: string;
}

function renderSocialIconsRow(): string {
  const links = BRAND.social
    .map((s) => `
      <a href="${escapeHtml(s.url)}" target="_blank" style="color: ${BRAND.colors.green}; text-decoration: none; font-weight: 600; font-family: ${BRAND.typography.family}; margin: 0 10px;">
        ${escapeHtml(s.name)}
      </a>
    `)
    .join('<span style="color: #e2e8f0; font-family: sans-serif;">·</span>');
  
  return `
    <div style="text-align: center; margin-bottom: 16px;">
      <span style="font-size: 12px; color: ${BRAND.colors.textMuted}; font-family: ${BRAND.typography.family}; padding-right: 4px;">Follow Us:</span>
      ${links}
    </div>
  `;
}

export function renderBrandedEmail(opts: RenderEmailOptions): string {
  const storefrontUrl = getStorefrontUrl();
  const previewText = escapeHtml(
    opts.previewText || `Message from ${BRAND.name}`
  );
  const heroEmoji = opts.heroEmoji
    ? `<div style="font-size: 32px; text-align: center; margin-bottom: 12px;">${opts.heroEmoji}</div>`
    : "";
  const heroHeading = opts.heroHeading
    ? renderGradientHeading(opts.heroHeading, 24)
    : "";
  const heroSubheading = opts.heroSubheading
    ? `<p style="color: ${BRAND.colors.textMuted}; font-size: 14px; text-align: center; margin: 0 0 16px 0; font-family: ${BRAND.typography.family};">${escapeHtml(opts.heroSubheading)}</p>`
    : "";

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(BRAND.name)}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: ${BRAND.colors.bgOuter}; font-family: ${BRAND.typography.family}; -webkit-font-smoothing: antialiased;">
  <div style="display:none;font-size:1px;color:${BRAND.colors.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${previewText}
  </div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${BRAND.colors.bgOuter}" style="background-color: ${BRAND.colors.bgOuter}; margin: 0; padding: 24px 12px;">
    <tbody>
      <tr>
        <td align="center" style="padding: 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 580px; background-color: ${BRAND.colors.white}; border: 1px solid ${BRAND.colors.borderSoft}; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <tbody>
              <!-- Header Brand Name Text -->
              <tr>
                <td style="padding: 32px 24px 12px 24px; text-align: center;">
                  <a href="${escapeHtml(storefrontUrl)}" target="_blank" style="font-family: ${BRAND.typography.family}; font-size: 26px; font-weight: 800; color: ${BRAND.colors.navy}; text-decoration: none; letter-spacing: -0.02em; display: inline-block;">
                    ${escapeHtml(BRAND.name)}
                  </a>
                </td>
              </tr>

              <!-- Hero Block -->
              ${heroEmoji || heroHeading || heroSubheading ? `
              <tr>
                <td style="padding: 0 24px 8px 24px; text-align: center;">
                  ${heroEmoji}
                  ${heroHeading}
                  ${heroSubheading}
                </td>
              </tr>
              ` : ""}

              <!-- Main Content Body -->
              <tr>
                <td style="padding: 8px 24px 24px 24px;">
                  <hr style="border: 0; border-top: 1px solid ${BRAND.colors.borderSoft}; margin: 0 0 20px 0;" />
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tbody>
                      <tr>
                        <td style="font-family: ${BRAND.typography.family}; font-size: 15px; line-height: 1.6; color: ${BRAND.colors.textBody};">
                          ${opts.body}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid ${BRAND.colors.borderSoft}; padding: 32px 24px; text-align: center;">
                  ${renderSocialIconsRow()}
                  <p style="margin: 0 0 8px 0; font-family: ${BRAND.typography.family}; font-size: 12px; color: ${BRAND.colors.textMuted}; line-height: 1.5; text-align: center;">
                    <a href="${escapeHtml(storefrontUrl)}" target="_blank" style="color: ${BRAND.colors.green}; text-decoration: none; font-weight: 600;">${escapeHtml(BRAND.name)}</a>
                    &nbsp;·&nbsp;
                    <a href="tel:${escapeHtml(BRAND.contact.phoneHref)}" style="color: ${BRAND.colors.textMuted}; text-decoration: none;">${escapeHtml(BRAND.contact.phone)}</a>
                    &nbsp;·&nbsp;
                    <a href="${escapeHtml(`${storefrontUrl}/contact`)}" target="_blank" style="color: ${BRAND.colors.textMuted}; text-decoration: none;">Contact Support</a>
                  </p>
                  <p style="margin: 0 0 12px 0; font-family: ${BRAND.typography.family}; font-size: 12px; color: ${BRAND.colors.textMuted}; line-height: 1.5; text-align: center;">
                    ${escapeHtml(BRAND.contact.addressLine1)}, ${escapeHtml(BRAND.contact.addressLine2)}
                  </p>
                  <p style="margin: 0; font-family: ${BRAND.typography.family}; font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center;">
                    Copyright © ${year} ${escapeHtml(BRAND.name)}. All rights reserved.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
