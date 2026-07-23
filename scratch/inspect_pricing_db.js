const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'price';
    `);
    console.log(`\nColumns in "price" table:`);
    console.table(res.rows);
    
    // Also let's inspect the 'price_set' or similar if 'price' doesn't contain direct connections
    const res2 = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%price%';
    `);
    console.log(`\nAll pricing-related tables:`);
    console.table(res2.rows);

  } catch (err) {
    console.error('Error querying pricing schema:', err);
  } finally {
    await client.end();
  }
}

main();
