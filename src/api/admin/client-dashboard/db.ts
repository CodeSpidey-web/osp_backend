export async function getDb(req: any) {
  const db = req.scope.resolve("__pg_connection__")
  
  // Ensure the inventory_history table exists in PostgreSQL
  await db.raw(`
    CREATE TABLE IF NOT EXISTS inventory_history (
      id SERIAL PRIMARY KEY,
      inventory_item_id VARCHAR(255) NOT NULL,
      sku VARCHAR(255) NOT NULL,
      product_title VARCHAR(255) NOT NULL,
      change_amount INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      updated_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  return db;
}
