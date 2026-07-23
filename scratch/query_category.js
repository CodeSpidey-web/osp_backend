const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    // 1. Query by ID
    const resId = await client.query(
      "SELECT * FROM product_category WHERE id = 'pcat_01KY74AD8AQN3GPCE0S3TV4GYC';"
    );
    console.log('Query result by ID (pcat_01KY74AD8AQN3GPCE0S3TV4GYC):');
    console.table(resId.rows);

    // 2. Query by Name
    const resName = await client.query(
      "SELECT id, name, handle, parent_category_id FROM product_category WHERE name ILIKE '%Sensor%' OR name ILIKE '%Development%';"
    );
    console.log('\nQuery result by Name (Sensor/Development):');
    console.table(resName.rows);

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

main();
