const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%category%';
    `);
    
    console.log('Category-related tables in database:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying tables:', err);
  } finally {
    await client.end();
  }
}

main();
