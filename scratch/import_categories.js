const fs = require('fs');
const { Client } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';
const mdPath = 'C:\\Users\\dilli\\.gemini\\antigravity-ide\\brain\\3a61d320-3757-454c-9051-424676e76b0d\\browser\\scratchpad_5paq7uqu.md';

function generateId() {
  // Generate ULID-compatible random hex ID with Medusa category prefix
  return 'pcat_01' + randomBytes(10).toString('hex').toUpperCase();
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

async function upsertCategory(client, name, parentId = null, parentMpath = '', rank = 0) {
  const handle = slugify(name);
  
  // Check if category with this handle already exists
  const checkRes = await client.query('SELECT id, mpath FROM product_category WHERE handle = $1', [handle]);
  
  let id, mpath;
  
  if (checkRes.rows.length > 0) {
    id = checkRes.rows[0].id;
    mpath = checkRes.rows[0].mpath;
    console.log(`[EXISTING] Category "${name}" (${handle}) already exists with ID: ${id}`);
    
    // Update properties in case they changed
    await client.query(`
      UPDATE product_category 
      SET name = $1, parent_category_id = $2, rank = $3, updated_at = NOW() 
      WHERE id = $4
    `, [name, parentId, rank, id]);
  } else {
    id = generateId();
    mpath = parentMpath ? `${parentMpath}${id}.` : `${id}.`;
    
    await client.query(`
      INSERT INTO product_category (
        id, name, handle, description, mpath, is_active, is_internal, rank, parent_category_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `, [
      id,
      name,
      handle,
      '', // description
      mpath,
      true, // is_active
      false, // is_internal
      rank,
      parentId
    ]);
    
    console.log(`[CREATED] Category "${name}" (${handle}) with ID: ${id}`);
  }
  
  return { id, mpath };
}

async function main() {
  console.log('Reading categories data from scratchpad file...');
  if (!fs.existsSync(mdPath)) {
    console.error('Error: scratchpad file does not exist at:', mdPath);
    return;
  }

  const rawMd = fs.readFileSync(mdPath, 'utf8');
  const jsonMatch = rawMd.match(/```json\n([\s\S]+?)\n```/);
  if (!jsonMatch) {
    console.error('Error: Could not find JSON block in markdown file!');
    return;
  }

  const categoryTree = JSON.parse(jsonMatch[1]);

  console.log('Connecting to database...');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    console.log('Starting transaction...');
    await client.query('BEGIN');

    let rootRank = 0;
    
    for (const [rootName, children] of Object.entries(categoryTree)) {
      // 1. Upsert Root parent category
      console.log(`Processing main category: ${rootName}`);
      const root = await upsertCategory(client, rootName, null, '', rootRank++);

      let childRank = 0;
      for (const childItem of children) {
        if (typeof childItem === 'string') {
          // 2. Simple Subcategory
          await upsertCategory(client, childItem, root.id, root.mpath, childRank++);
        } else if (typeof childItem === 'object' && childItem !== null) {
          // 3. Subcategory with nested children (e.g. Resistors -> SMD Resistors)
          for (const [subName, subSubs] of Object.entries(childItem)) {
            const sub = await upsertCategory(client, subName, root.id, root.mpath, childRank++);

            let subSubRank = 0;
            for (const subSubName of subSubs) {
              await upsertCategory(client, subSubName, sub.id, sub.mpath, subSubRank++);
            }
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('SUCCESS: All categories and subcategories imported successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during import. Rolled back database changes:', err);
  } finally {
    await client.end();
  }
}

main();
