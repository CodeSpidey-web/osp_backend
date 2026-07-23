const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';

console.log('Connecting to database:', dbUrl.replace(/:[^:]+@/, ':****@'));

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  await client.connect();
  try {
    // 1. Inspect table columns of product_category
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'product_category';
    `);
    
    console.log('Columns in product_category table:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
