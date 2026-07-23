const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT id, name, deleted_at 
      FROM product_category 
      WHERE name IN ('Sensors', 'Development Boards');
    `);
    
    console.log('Categories status:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
