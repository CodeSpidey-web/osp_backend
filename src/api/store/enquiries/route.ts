import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendMail } from "../../../utils/mail";
import {
  BRAND,
  escapeHtml,
  getBackendUrl,
  getStorefrontUrl,
  renderBrandedEmail,
  renderButton,
  renderGradientHeading,
  renderSummaryCard,
} from "../../../utils/emailLayout";

function enquiryDetailRows(
  name: string,
  email: string,
  phone: string,
  college: string,
  message: string,
  file_name?: string,
  file_type?: string
): [string, string][] {
  const rows: [string, string][] = [
    ["Student Name", name],
    ["Email", `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND.colors.green};text-decoration:underline;">${escapeHtml(email)}</a>`],
    ["Phone", phone],
    ["College Name", college],
    ["Message", `<span style="white-space:pre-wrap;">${escapeHtml(message)}</span>`],
  ];
  if (file_name) {
    rows.push(["Attachment", `${file_name}${file_type ? ` (${file_type})` : ""}`]);
  }
  return rows;
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;

  const { name, email, phone, college, message, file_name, file_data, file_type } = req.body as {
    name: string;
    email: string;
    phone: string;
    college: string;
    message: string;
    file_name?: string;
    file_data?: string;
    file_type?: string;
  };

  if (!name || !email || !phone || !college || !message) {
    return res.status(400).json({ message: "Missing required fields (name, email, phone, college, message)" });
  }

  try {
    // 1. Ensure project_enquiry table exists
    await db.raw(`
      CREATE TABLE IF NOT EXISTS project_enquiry (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        college VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        file_name VARCHAR(255),
        file_data TEXT,
        file_type VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Generate unique ID & Insert enquiry
    const enquiryId = `enq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await db.raw(`
      INSERT INTO project_enquiry (id, name, email, phone, college, message, file_name, file_data, file_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      enquiryId,
      name,
      email,
      phone,
      college,
      message,
      file_name || null,
      file_data || null,
      file_type || null
    ]);

    // Send Confirmation Email to the Student
    const storefrontUrl = getStorefrontUrl();
    const typoFamily = BRAND.typography.family;
    const goldBg = `${BRAND.colors.gold}10`;
    const goldBd = `${BRAND.colors.gold}30`;
    const navy = BRAND.colors.navy;
    const green = BRAND.colors.green;
    const textBody = BRAND.colors.textBody;
    const phoneHref = BRAND.contact.phoneHref;
    const phoneText = BRAND.contact.phone;
    const backendUrl = getBackendUrl();

    sendMail({
      to: email,
      subject: `Project Enquiry Received - #${enquiryId}`,
      html: renderBrandedEmail({
        previewText: `Thank you ${name}, we've received your project enquiry (ref #${enquiryId}). Our team will respond within 24 hours.`,
        heroEmoji: "📝",
        heroHeading: "We've Received Your Enquiry",
        heroSubheading: `Thank you for reaching out to ${BRAND.name}. A support advisor will review your project details shortly.`,
        body: `
          ${renderSummaryCard("Enquiry Details", enquiryDetailRows(name, email, phone, college, message, file_name, file_type), "🔖")}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:18px 22px;background-color:${goldBg};border:1px solid ${goldBd};border-radius:14px;margin-top:22px;">
            <tr>
              <td style="font-family:${typoFamily};font-size:15px;line-height:1.6;color:${textBody};">
                <p style="margin:0 0 10px 0;"><strong style="color:${navy};">⏱ Response Time</strong></p>
                <p style="margin:0;">We usually respond within <strong>24 hours</strong>. If you need urgent assistance, call us directly on <a href="tel:${phoneHref}" style="color:${green};text-decoration:underline;font-weight:600;">${phoneText}</a> or message us on WhatsApp!</p>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="text-align:center;margin-top:28px;">
            <tr>
              <td>
                ${renderButton({ label: "Visit Our Storefront", href: storefrontUrl, variant: "primary" })}
              </td>
            </tr>
          </table>
        `,
      }),
    }).catch(err => console.error("Error sending enquiry confirmation email:", err));

    // Send Alert Email to the Admin (oceanstudentprojects@gmail.com)
    sendMail({
      to: "oceanstudentprojects@gmail.com",
      subject: `🚨 New Project Enquiry - ${name} (${college})`,
      html: renderBrandedEmail({
        previewText: `New enquiry from ${name} (${college}). Reference #${enquiryId}. Review in the Admin Dashboard now.`,
        heroEmoji: "🚨",
        heroHeading: "New Project Enquiry",
        heroSubheading: `A new student project enquiry has been submitted. Review the details and respond promptly.`,
        body: `
          ${renderSummaryCard("Student Enquiry", enquiryDetailRows(name, email, phone, college, message, file_name, file_type), "📥")}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="text-align:center;margin-top:26px;">
            <tr>
              <td>
                ${renderButton({ label: "Open Admin Dashboard", href: `${backendUrl}/app/project-enquiries`, variant: "orange" })}
              </td>
            </tr>
          </table>
        `,
      }),
    }).catch(err => console.error("Error sending admin enquiry alert email:", err));

    res.json({ success: true, id: enquiryId });
  } catch (error: any) {
    console.error("Error creating project enquiry:", error);
    res.status(500).json({ message: error.message || "An error occurred saving project enquiry" });
  }
}
