const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    const tables = ['product', 'product_variant', 'product_category_product'];
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      console.log(`\nColumns in "${table}" table:`);
      console.table(res.rows);
    }
  } catch (err) {
    console.error('Error querying schema:', err);
  } finally {
    await client.end();
  }
}

main();
