import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import scrypt from "scrypt-kdf";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const authContext = (req as any).auth_context;
  const actorId = authContext?.actor_id;

  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { currentPassword, newPassword } = req.body as any;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current password and new password are required." });
  }

  try {
    // 1. Retrieve current user profile
    const userModuleService = req.scope.resolve("user") as any;
    const user = await userModuleService.retrieveUser(actorId);
    const email = user.email;

    // 2. Fetch auth identity credentials from PostgreSQL provider_identity table
    const db = req.scope.resolve("__pg_connection__") as any;
    const authRows = await db.raw(
      `SELECT * FROM provider_identity WHERE provider = 'emailpass' AND entity_id = ?`,
      [email]
    );

    if (authRows.rows.length === 0) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    const authRecord = authRows.rows[0];
    const storedHashBase64 = authRecord.provider_metadata?.password;

    if (!storedHashBase64) {
      return res.status(400).json({ message: "No password associated with this profile." });
    }

    // 3. Verify current password hash
    const hashBuffer = Buffer.from(storedHashBase64, "base64");
    const isMatch = await scrypt.verify(hashBuffer, currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password." });
    }

    // 4. Hash the new password with standard scrypt parameters
    const newHashBuffer = await scrypt.kdf(newPassword, { logN: 15, r: 8, p: 1 });
    const newHashBase64 = newHashBuffer.toString("base64");

    // 5. Update the credentials record in PostgreSQL
    await db.raw(
      `UPDATE provider_identity 
       SET provider_metadata = jsonb_set(provider_metadata, '{password}', ?) 
       WHERE id = ?`,
      [`"${newHashBase64}"`, authRecord.id]
    );

    res.json({ message: "Password updated successfully!" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred while changing password." });
  }
}
