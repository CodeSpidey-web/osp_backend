import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ message: "Enquiry ID is required" });
  }

  try {
    // Fetch file columns from DB
    const enquiries = await db.raw(
      "SELECT file_name, file_data, file_type FROM project_enquiry WHERE id = ?",
      [id]
    );

    if (!enquiries.rows || enquiries.rows.length === 0) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    const row = enquiries.rows[0];
    if (!row.file_data) {
      return res.status(400).json({ message: "No file was uploaded with this enquiry" });
    }

    // Parse base64 content
    let base64Content = row.file_data;
    if (base64Content.includes(";base64,")) {
      base64Content = base64Content.split(";base64,")[1];
    }

    const fileBuffer = Buffer.from(base64Content, "base64");
    const contentType = row.file_type || "application/octet-stream";
    const filename = row.file_name || "download";

    // Set download headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", fileBuffer.length.toString());

    res.send(fileBuffer);
  } catch (error: any) {
    console.error("Error downloading file:", error);
    res.status(500).json({ message: error.message || "An error occurred downloading the file" });
  }
}
