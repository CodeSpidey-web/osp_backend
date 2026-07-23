const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const csvPath = 'c:\\Users\\dilli\\Downloads\\medusa\\my-electronics-store\\techtonics_products.csv';

function generateId(prefix) {
  return prefix + '_01' + randomBytes(10).toString('hex').toUpperCase();
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const cleanPrice = (priceStr) => {
  if (!priceStr) return 0;
  const numericStr = priceStr.replace(/[^\d\.]/g, '');
  return parseFloat(numericStr) || 0;
};

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log('Loading existing categories from database...');
  const catRes = await client.query('SELECT id, name FROM product_category;');
  const categoryCache = new Map();
  catRes.rows.forEach(row => {
    categoryCache.set(row.name.toLowerCase().trim(), row.id);
  });
  console.log(`Loaded ${categoryCache.size} categories into memory.`);

  console.log('Opening CSV file...');
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let importedCount = 0;
  let skippedCount = 0;

  try {
    console.log('Starting bulk transaction...');
    await client.query('BEGIN');

    for await (const line of rl) {
      lineCount++;
      if (lineCount === 1) continue; // Skip header row
      if (!line.trim()) continue;

      const parts = parseCsvLine(line);
      if (parts.length < 5) continue;

      const categoryName = parts[0];
      const categoryType = parts[1];
      const productName = parts[2];
      const priceStr = parts[3];
      const stockStatus = parts[4];
      const productUrl = parts[5] || '';

      if (!productName || !priceStr) continue;

      const handle = slugify(productName);

      // 1. Check if product already exists (by handle)
      const prodCheck = await client.query('SELECT id FROM product WHERE handle = $1', [handle]);
      if (prodCheck.rows.length > 0) {
        skippedCount++;
        continue;
      }

      // 2. Resolve Category ID (create category if it does not exist)
      const cleanCatName = categoryName.trim();
      let categoryId = categoryCache.get(cleanCatName.toLowerCase());
      
      if (!categoryId) {
        // Create new root category
        const newCatId = generateId('pcat');
        const catHandle = slugify(cleanCatName);
        await client.query(`
          INSERT INTO product_category (
            id, name, handle, description, mpath, is_active, is_internal, rank, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `, [newCatId, cleanCatName, catHandle, '', `${newCatId}.`, true, false, 0]);
        
        categoryId = newCatId;
        categoryCache.set(cleanCatName.toLowerCase(), newCatId);
        console.log(`[CAT CREATED] Category "${cleanCatName}" (${catHandle})`);
      }

      // 3. Clean price
      const price = cleanPrice(priceStr);

      // 4. Determine inventory rules
      const manageInventory = (stockStatus.toLowerCase() === 'out of stock');

      // 5. Insert Product
      const productId = generateId('prod');
      await client.query(`
        INSERT INTO product (
          id, title, handle, subtitle, description, is_giftcard, status, thumbnail, discountable, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        productId,
        productName,
        handle,
        '', // subtitle
        `High-quality ${productName} available at Ocean Student Projects. Ideal for school lab experiments, electronics prototyping, and robotics.`,
        false,
        'published',
        '/assets/images/product/placeholder.webp', // generic fallback placeholder
        true
      ]);

      // 6. Link Product to Category
      await client.query(`
        INSERT INTO product_category_product (product_id, product_category_id)
        VALUES ($1, $2)
      `, [productId, categoryId]);

      // 7. Create Product Variant
      const variantId = generateId('variant');
      const sku = `OSP-${randomBytes(4).toString('hex').toUpperCase()}`;
      await client.query(`
        INSERT INTO product_variant (
          id, title, sku, manage_inventory, allow_backorder, product_id, created_at, updated_at, variant_rank
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 0)
      `, [
        variantId,
        'Default Variant',
        sku,
        manageInventory,
        false,
        productId
      ]);

      // 8. Create Price Set container
      const priceSetId = generateId('pset');
      await client.query(`
        INSERT INTO price_set (id, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
      `, [priceSetId]);

      // 9. Link Variant to Price Set
      const pvpsId = generateId('pvps');
      await client.query(`
        INSERT INTO product_variant_price_set (id, variant_id, price_set_id, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `, [pvpsId, variantId, priceSetId]);

      // 10. Insert Price record (INR)
      const priceId = generateId('price');
      await client.query(`
        INSERT INTO price (
          id, price_set_id, currency_code, amount, raw_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        priceId,
        priceSetId,
        'inr',
        price,
        JSON.stringify({ value: price * 100, precision: 2 })
      ]);

      importedCount++;
      if (importedCount % 200 === 0) {
        console.log(`Progress: Imported ${importedCount} products...`);
      }
    }

    await client.query('COMMIT');
    console.log('\nSUCCESS: Bulk product import completed successfully!');
    console.log(`Total rows checked: ${lineCount}`);
    console.log(`Total new products imported: ${importedCount}`);
    console.log(`Total skipped (already exist): ${skippedCount}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during bulk import. Database changes rolled back:', err);
  } finally {
    await client.end();
  }
}

main();
