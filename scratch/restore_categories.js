const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  try {
    console.log('Checking for all soft-deleted categories...');
    const checkRes = await client.query(`
      SELECT id, name, deleted_at 
      FROM product_category 
      WHERE deleted_at IS NOT NULL;
    `);
    
    console.log('Found soft-deleted categories:');
    console.table(checkRes.rows);

    if (checkRes.rows.length > 0) {
      console.log('Restoring (undeleting) these categories...');
      const restoreRes = await client.query(`
        UPDATE product_category 
        SET deleted_at = NULL 
        WHERE deleted_at IS NOT NULL;
      `);
      console.log(`Success: Restored ${restoreRes.rowCount} categories!`);
    } else {
      console.log('No soft-deleted categories found.');
    }
  } catch (err) {
    console.error('Error during database update:', err);
  } finally {
    await client.end();
  }
}

main();
