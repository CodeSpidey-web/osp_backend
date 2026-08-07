import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/client-dashboard/enquiries
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;

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

    // 2. Fetch all enquiries (EXCLUDING file_data column for performance)
    const enquiriesRes = await db.raw(`
      SELECT id, name, email, phone, college, message, file_name, file_type, created_at
      FROM project_enquiry
      ORDER BY created_at DESC
    `);

    res.json({ enquiries: enquiriesRes.rows || [] });
  } catch (error: any) {
    console.error("Error retrieving project enquiries:", error);
    res.status(500).json({ message: error.message || "An error occurred retrieving enquiries" });
  }
}

// DELETE /admin/client-dashboard/enquiries?id=...
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const db = req.scope.resolve("__pg_connection__") as any;
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({ message: "Enquiry ID is required" });
  }

  try {
    await db.raw("DELETE FROM project_enquiry WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting project enquiry:", error);
    res.status(500).json({ message: error.message || "An error occurred deleting enquiry" });
  }
}
