const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    const res = await client.query('SELECT COUNT(*) FROM product_category;');
    console.log('Total categories in database:', res.rows[0].count);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
