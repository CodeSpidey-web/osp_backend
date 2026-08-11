// ============================================================================
// CENTRALIZED BRANDED EMAIL LAYOUT
// Ocean Student Projects - Shared master template, theme, helpers
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Brand Configuration (colors, logo, social, URLs)
//    Change once, applied everywhere.
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
    bgOuter: "#f1f5f9",
    bgCard: "#ffffff",
    textPrimary: "#0f172a",
    textBody: "#475569",
    textMuted: "#64748b",
    borderSoft: "#e2e8f0",
    tableHeaderBg: "#f8fafc",
    accentCardBg: "linear-gradient(135deg, rgba(19, 108, 57, 0.06) 0%, rgba(254, 208, 0, 0.06) 100%)",
    accentCardBorder: "rgba(19, 108, 57, 0.12)",
  },

  gradientHeadingCss:
    "background: linear-gradient(135deg, #0b2545 0%, #136c39 50%, #eb7f23 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: #0b2545;",

  typography: {
    family:
      "'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif",
  },

  logo: {
    // Reuse the exact logo bitmap currently in the storefront header/footer.
    // Production emails need a fully-qualified URL, so we prefix with STOREFRONT_URL.
    storefrontRelativePath: "/assets/images/logo/bitmap_cropped.png",
    altText: "Ocean Student Projects Logo",
    maxWidthPx: 220,
  },

  contact: {
    phone: "+91 904 268 6793",
    phoneHref: "+919042686793",
    addressLine1: "No.10 Kareem Mohideen sahib St, Chintadripet",
    addressLine2: "Chennai - 600002, Tamil Nadu, India",
    supportEmail: "oceanstudentprojects@gmail.com",
  },

  // Reuse the social links configured in Footer.tsx. Keep these in sync.
  social: [
    {
      name: "Facebook",
      url: "https://www.facebook.com/profile.php?id=61576958505445",
      iconLabel: "f",
      color: "#1877F2",
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/ocean_student_projects?utm_source=qr&igsh=eWdnNXd5aHY0OHRi",
      iconLabel: "IG",
      color: "#E1306C",
    },
    {
      name: "YouTube",
      url: "https://www.youtube.com/@OceanStudentProjects-r1p",
      iconLabel: "YT",
      color: "#FF0000",
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. URL helpers - never use localhost or relative URLs in production emails
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

export function getLogoUrl(): string {
  return `${getStorefrontUrl()}${BRAND.logo.storefrontRelativePath}`;
}

// ---------------------------------------------------------------------------
// 3. HTML helpers (safe and email-friendly)
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
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 24px auto; display: inline-block;">
      <tbody>
        <tr>
          <td style="border-radius: 10px; background: ${bg}; border: 1px solid ${border};">
            <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 13px 32px; font-family: ${BRAND.typography.family}; font-size: 15px; font-weight: 700; color: ${BRAND.colors.white}; text-decoration: none; border-radius: 10px; letter-spacing: 0.01em;">
              ${safeLabel}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// Render a heading with the same Navy->Green->Orange gradient used in the
// storefront hero headings (falls back to solid navy on Outlook/Gmail).
export function renderGradientHeading(text: string, sizePx = 26): string {
  const safe = escapeHtml(text);
  return `
    <h2 style="margin: 0 0 8px 0; font-family: ${BRAND.typography.family}; font-size: ${sizePx}px; font-weight: 800; line-height: 1.2; ${BRAND.gradientHeadingCss}">
      ${safe}
    </h2>
  `;
}

// Info-card / summary block used in shipped / order detail emails.
// Pass rows as [label, value][] pairs.
export function renderSummaryCard(
  title: string,
  rows: Array<[string, string]>,
  iconEmoji = "📋"
): string {
  const rowsHtml = rows
    .map(([label, value]) => {
      return `
        <p style="margin: 6px 0; color: ${BRAND.colors.textBody}; font-size: 13px; line-height: 1.5;">
          <strong style="color: ${BRAND.colors.navy}; display: inline-block; min-width: 110px;">${escapeHtml(label)}:</strong>
          ${value}
        </p>
      `;
    })
    .join("");
  return `
    <div style="background: ${BRAND.colors.accentCardBg}; border: 1px solid ${BRAND.colors.accentCardBorder}; padding: 18px 20px; border-radius: 10px; margin: 24px 0;">
      <p style="margin: 0 0 12px 0; color: ${BRAND.colors.textPrimary}; font-size: 14px; font-weight: 700;">
        ${iconEmoji} ${escapeHtml(title)}
      </p>
      ${rowsHtml}
    </div>
  `;
}

// Order items table with product, qty, and amount columns.
export interface OrderItemRow {
  title: string;
  quantity: number | string;
  amount: string; // fully formatted, e.g. "INR 199.00"
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
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 12px 0 24px 0; font-family: ${BRAND.typography.family};">
      <thead>
        <tr style="border-bottom: 2px solid ${BRAND.colors.borderSoft}; text-align: left; background: ${BRAND.colors.tableHeaderBg};">
          <th style="padding: 10px 8px; color: ${BRAND.colors.textBody}; font-weight: 600; font-size: 13px;">Product</th>
          <th style="padding: 10px 8px; text-align: center; color: ${BRAND.colors.textBody}; font-weight: 600; font-size: 13px;">Qty</th>
          <th style="padding: 10px 8px; text-align: right; color: ${BRAND.colors.textBody}; font-weight: 600; font-size: 13px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Totals breakdown table (Subtotal, Shipping, GST, Grand Total).
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
      const size = r.highlighted ? "18px" : "14px";
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
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: ${BRAND.typography.family};">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// 5. Master Email Layout - renderBrandedEmail() - the wrapper used by ALL emails
// ---------------------------------------------------------------------------

export interface RenderEmailOptions {
  previewText?: string;
  /** Email body (inner HTML) — already escaped by the caller where needed. */
  body: string;
  /** Email purpose / hero emoji shown above the heading in the header accent line */
  heroEmoji?: string;
  /** Big heading rendered with the Navy->Green->Orange gradient */
  heroHeading?: string;
  /** Smaller sub-heading under the hero heading */
  heroSubheading?: string;
}

function renderSocialIconsRow(): string {
  const buttons = BRAND.social
    .map((s) => {
      const url = escapeHtml(s.url);
      const label = escapeHtml(s.name);
      const inner = escapeHtml(s.iconLabel);
      return `
        <td style="padding: 0 6px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
            <tbody>
              <tr>
                <td style="width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); text-align: center;">
                  <a href="${url}" target="_blank" title="${label}" aria-label="${label}" style="display: inline-block; width: 100%; line-height: 38px; font-family: ${BRAND.typography.family}; font-size: 13px; font-weight: 700; color: #cbd5e1; text-decoration: none;">
                    ${inner}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      `;
    })
    .join("");
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
      <tbody>
        <tr>
          <td style="font-size: 12px; color: #cbd5e1; font-weight: 600; font-family: ${BRAND.typography.family}; padding-right: 10px; vertical-align: middle;">
            Follow Us:
          </td>
          ${buttons}
        </tr>
      </tbody>
    </table>
  `;
}

export function renderBrandedEmail(opts: RenderEmailOptions): string {
  const logoUrl = getLogoUrl();
  const storefrontUrl = getStorefrontUrl();
  const previewText = escapeHtml(
    opts.previewText || `Message from ${BRAND.name}`
  );
  const heroEmoji = opts.heroEmoji
    ? `<div style="font-size: 38px; line-height: 1; margin-bottom: 8px;">${opts.heroEmoji}</div>`
    : "";
  const heroHeading = opts.heroHeading
    ? renderGradientHeading(opts.heroHeading, 26)
    : "";
  const heroSubheading = opts.heroSubheading
    ? `<p style="color: ${BRAND.colors.textBody}; font-size: 15px; margin: 0; font-family: ${BRAND.typography.family};">${escapeHtml(opts.heroSubheading)}</p>`
    : "";

  const year = new Date().getFullYear();

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(BRAND.name)}</title>
  <style type="text/css">
    @media only screen and (max-width: 620px) {
      .osp-email-outer { padding: 16px 8px !important; }
      .osp-email-card { padding: 24px 18px !important; }
      .osp-logo-cell img { max-width: 180px !important; }
      .osp-hero h2 { font-size: 22px !important; }
      .osp-footer-inner { padding: 28px 18px !important; }
      table.osp-full { width: 100% !important; }
    }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: ${BRAND.colors.bgOuter}; font-family: ${BRAND.typography.family};">
  <div style="display:none;font-size:1px;color:${BRAND.colors.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${previewText}
  </div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${BRAND.colors.bgOuter}" class="osp-email-outer" style="background-color: ${BRAND.colors.bgOuter}; margin: 0; padding: 32px 16px;">
    <tbody>
      <tr>
        <td align="center" style="padding: 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 620px;" class="osp-full">
            <tbody>
              <!-- =========================================================
                   HEADER BAR (with logo, accent border)
                   ========================================================= -->
              <tr>
                <td style="background: ${BRAND.colors.white}; border-radius: 14px 14px 0 0; border: 1px solid ${BRAND.colors.borderSoft}; border-bottom: none; padding: 24px 32px; text-align: center;" class="osp-logo-cell">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tbody>
                      <tr>
                        <td style="border-top: 3px solid ${BRAND.colors.green}; display: block; width: 100%; padding-top: 16px; margin-top: -24px;"></td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 12px;">
                          <a href="${escapeHtml(storefrontUrl)}" target="_blank" style="display: inline-block; text-decoration: none;">
                            <img
                              src="${escapeHtml(logoUrl)}"
                              alt="${escapeHtml(BRAND.logo.altText)}"
                              width="${BRAND.logo.maxWidthPx}"
                              style="max-width: ${BRAND.logo.maxWidthPx}px; width: 100%; height: auto; display: block; border: 0; outline: none; text-decoration: none;"
                            />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- =========================================================
                   HERO BANNER (emoji + gradient heading + subheading)
                   ========================================================= -->
              ${heroEmoji || heroHeading || heroSubheading ? `
              <tr>
                <td style="background: ${BRAND.colors.white}; border-left: 1px solid ${BRAND.colors.borderSoft}; border-right: 1px solid ${BRAND.colors.borderSoft}; padding: 4px 32px 12px 32px; text-align: center;" class="osp-email-card osp-hero">
                  ${heroEmoji}
                  ${heroHeading}
                  ${heroSubheading}
                </td>
              </tr>
              ` : ""}

              <!-- =========================================================
                   MAIN CONTENT CARD
                   ========================================================= -->
              <tr>
                <td style="background: ${BRAND.colors.white}; border-left: 1px solid ${BRAND.colors.borderSoft}; border-right: 1px solid ${BRAND.colors.borderSoft}; padding: 12px 32px 28px 32px; color: ${BRAND.colors.textBody};" class="osp-email-card">
                  <hr style="border: 0; border-top: 1px solid ${BRAND.colors.borderSoft}; margin: 8px 0 20px 0;" />
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tbody>
                      <tr>
                        <td style="font-family: ${BRAND.typography.family}; font-size: 15px; line-height: 1.65; color: ${BRAND.colors.textBody};">
                          ${opts.body}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- =========================================================
                   FOOTER
                   ========================================================= -->
              <tr>
                <td style="border-radius: 0 0 14px 14px; background: linear-gradient(180deg, #071f12 0%, #031008 100%); border: 1px solid ${BRAND.colors.borderSoft}; border-top: 3px solid ${BRAND.colors.green}; padding: 0;" class="osp-footer-inner">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tbody>
                      <tr>
                        <td align="center" style="padding: 28px 32px 20px 32px;">
                          ${renderSocialIconsRow()}
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 0 32px 10px 32px;">
                          <p style="margin: 0; font-family: ${BRAND.typography.family}; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                            <a href="${escapeHtml(storefrontUrl)}" target="_blank" style="color: #4ade80; text-decoration: none; font-weight: 700;">${escapeHtml(BRAND.name)}</a>
                            &nbsp;·&nbsp;
                            <a href="tel:${escapeHtml(BRAND.contact.phoneHref)}" style="color: #cbd5e1; text-decoration: none;">${escapeHtml(BRAND.contact.phone)}</a>
                            &nbsp;·&nbsp;
                            <a href="${escapeHtml(`${storefrontUrl}/contact`)}" target="_blank" style="color: #cbd5e1; text-decoration: none;">Contact</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 0 32px 4px 32px;">
                          <p style="margin: 0; font-family: ${BRAND.typography.family}; font-size: 12px; color: #64748b; line-height: 1.5;">
                            ${escapeHtml(BRAND.contact.addressLine1)}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 0 32px 24px 32px;">
                          <p style="margin: 0; font-family: ${BRAND.typography.family}; font-size: 12px; color: #64748b; line-height: 1.5;">
                            ${escapeHtml(BRAND.contact.addressLine2)}
                          </p>
                          <p style="margin: 10px 0 0 0; font-family: ${BRAND.typography.family}; font-size: 12px; color: #475569; line-height: 1.5;">
                            Copyright © ${year} <a href="${escapeHtml(storefrontUrl)}" target="_blank" style="color: #4ade80; font-weight: 700; text-decoration: none;">${escapeHtml(BRAND.name)}</a>. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
  `;
}
