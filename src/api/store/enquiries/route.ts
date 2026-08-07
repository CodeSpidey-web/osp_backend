import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { sendMail } from "../../../utils/mail";

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
    sendMail({
      to: email,
      subject: `Project Enquiry Received - #${enquiryId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #edf2f7; border-radius: 8px;">
          <h3 style="color: #136c39;">Hello ${name},</h3>
          <p>Thank you for reaching out to <strong>Ocean Student Projects</strong>. We have received your project enquiry and a support advisor will review it shortly.</p>
          <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0 0 5px 0;"><strong>Enquiry Reference:</strong> #${enquiryId}</p>
            <p style="margin: 0 0 5px 0;"><strong>College:</strong> ${college}</p>
            <p style="margin: 0 0 5px 0;"><strong>Message:</strong> ${message}</p>
            ${file_name ? `<p style="margin: 0;"><strong>Uploaded Attachment:</strong> ${file_name}</p>` : ""}
          </div>
          <p>We usually respond within 24 hours. If you need urgent assistance, you can also message us directly on WhatsApp!</p>
          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;" />
          <div style="text-align: center; font-size: 12px; color: #a0aec0;">
            <p>Ocean Student Projects</p>
            <p>No.10 Kareem Mohideen sahib St, Chintadripet, Chennai - 600002, Tamil Nadu, India.</p>
          </div>
        </div>
      `
    }).catch(err => console.error("Error sending enquiry confirmation email:", err));

    // Send Alert Email to the Admin (oceanstudentprojects@gmail.com)
    sendMail({
      to: "oceanstudentprojects@gmail.com",
      subject: `🚨 New Project Enquiry - ${name} (${college})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #edf2f7; border-radius: 8px; background-color: #fefaf6;">
          <h3 style="color: #d69e2e; margin-top: 0;">🚨 New Student Project Enquiry Received</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #ffffff; border: 1px solid #edf2f7;">
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7; width: 30%;">Student Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Phone:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${phone}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">College Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${college}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7; vertical-align: top;">Message:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7; white-space: pre-wrap;">${message}</td>
            </tr>
            ${file_name ? `
            <tr>
              <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #edf2f7;">Attachment:</td>
              <td style="padding: 10px; border-bottom: 1px solid #edf2f7;">${file_name} (${file_type})</td>
            </tr>
            ` : ""}
          </table>
          <div style="text-align: center; margin-top: 20px;">
            <a href="http://localhost:9000/app/project-enquiries" target="_blank" style="background-color: #d69e2e; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              View in Admin Dashboard
            </a>
          </div>
        </div>
      `
    }).catch(err => console.error("Error sending admin enquiry alert email:", err));

    res.json({ success: true, id: enquiryId });
  } catch (error: any) {
    console.error("Error creating project enquiry:", error);
    res.status(500).json({ message: error.message || "An error occurred saving project enquiry" });
  }
}
