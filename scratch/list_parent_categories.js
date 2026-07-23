const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT name 
      FROM product_category 
      WHERE parent_category_id IS NULL;
    `);
    
    console.log('Parent Categories in Database:');
    const names = res.rows.map(r => r.name).sort();
    console.log(names);
    console.log('Total Count:', names.length);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
