const { Client } = require('pg');
const { randomBytes } = require('crypto');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:12345678@localhost/medusa-store';

const products = [
  {
    name: "0-30V 2mA-3A Continuously Adjustable DC Regulated Power Supply DIY Kit for School Education Lab",
    price: 399.00,
    image: "https://techtonics.in/wp-content/uploads/2024/03/tech2152-5.jpeg"
  },
  {
    name: "16 Interesting Sounds Music Box DIY Kit – Blue",
    price: 135.00,
    image: "https://techtonics.in/wp-content/uploads/2025/10/tech2711-1.jpg"
  },
  {
    name: "210pcs Screw Kit for Robot Accessories",
    price: 749.00,
    image: "https://techtonics.in/wp-content/uploads/2024/09/tech2511-10.jpg"
  },
  {
    name: "30S Sound Voice Music Recorder Board Photosensitive Wired Double button control Programmable Chip Audio Module For Greeting Card DIY",
    price: 290.00,
    image: "https://techtonics.in/wp-content/uploads/2023/10/tech2189-21-1.jpg"
  },
  {
    name: "500Pcs Metal Film Resistors Kit – 50 Resistance Values 1/2W 1% Tolerance",
    price: 590.00,
    image: "https://techtonics.in/wp-content/uploads/2025/10/tech2664-1.jpg"
  },
  {
    name: "620 pcs Dupont Connector 2.54mm, Dupont Cable Jumper Wire Pin Header Housing Assorted Kit",
    price: 350.00,
    image: "https://techtonics.in/wp-content/uploads/2024/09/tech2510-10.jpg"
  },
  {
    name: "A88 Metal Detector Non-Contact Metal Induction Detection DIY Kit",
    price: 99.00,
    image: "https://techtonics.in/wp-content/uploads/2023/01/tech1981-2.jpg"
  },
  {
    name: "Analog Micro Wind Generator System DC Motor with Propeller",
    price: 425.00,
    image: "https://techtonics.in/wp-content/uploads/2023/05/tech2197-1.webp"
  },
  {
    name: "Arduino Uno Basic Starter Kit by Ketrix with 18+ Tutorial and Code",
    price: 1199.00,
    image: "https://techtonics.in/wp-content/uploads/2025/01/TECH2502-1.jpg"
  },
  {
    name: "BD243 Assembled Mini Tesla Coil Electronics Wireless Transmission Module 9-12V",
    price: 275.00,
    image: "https://techtonics.in/wp-content/uploads/2021/10/tech1658-1.webp"
  },
  {
    name: "CF210SP DIY Electronic Assembly Kit for AM/FM Stereo Radio",
    price: 499.00,
    image: "https://techtonics.in/wp-content/uploads/2024/03/tech2130-1.jpg"
  },
  {
    name: "D2-6 Bluetooth Remote Control Intelligent Car 51 MCU DIY Kit",
    price: 649.00,
    image: "https://techtonics.in/wp-content/uploads/2023/11/tech2412-1.webp"
  },
  {
    name: "DC5V Humidifier USB Spray Module 108KHz with foam stick",
    price: 130.00,
    image: "https://techtonics.in/wp-content/uploads/2024/08/2487-1.webp"
  },
  {
    name: "DC5V Humidifier USB Spray Module DIY Incubation Experiment 108KHz",
    price: 119.00,
    image: "https://techtonics.in/wp-content/uploads/2024/08/tech2486-11.jpg"
  },
  {
    name: "DIY D2-5 Intelligent Tracking Line Car Kit",
    price: 299.00,
    image: "https://techtonics.in/wp-content/uploads/2023/11/tech2411-1.webp"
  },
  {
    name: "DIY Frequency Tester 1Hz-50MHz Crystal Counter Meter With Case Kit",
    price: 550.00,
    image: "https://techtonics.in/wp-content/uploads/2023/05/tech2191-3.webp"
  },
  {
    name: "DIY Mini Wind Turbine Blade Vertical Axis Micro Generator Blades Small Set",
    price: 349.00,
    image: "https://techtonics.in/wp-content/uploads/2023/05/tech2196-1-300x300-1.webp"
  },
  {
    name: "DIY NE555 Ding Dong Bell Doorbell Module Kit – Electronic Music Production Training Kit",
    price: 95.00,
    image: "https://techtonics.in/wp-content/uploads/2025/10/tech2710-2.jpg"
  },
  {
    name: "Full Set of 17DOF Biped Robot Educational Robotic Kit +(17pcs) MG995+Servo Horn Unassembled",
    price: 14499.00,
    image: "https://techtonics.in/wp-content/uploads/2025/10/tech2610-1.jpg"
  },
  {
    name: "NE555 + CD4017 Water Flowing Light LED Module DIY Kit",
    price: 65.00,
    image: "https://techtonics.in/wp-content/uploads/2022/12/tech1948-3-300x300-1.webp"
  },
  {
    name: "RDA5807 DIY Electronic Kit Wireless Stereo FM Radio Receiver Module PCB 76MHz-108MHz DC 1.8V-3.6V",
    price: 249.00,
    image: "https://techtonics.in/wp-content/uploads/2025/06/tech2254-1.jpg"
  },
  {
    name: "Tactile Push Button Switch Assorted Kit – 25 pcs",
    price: 125.00,
    image: "https://techtonics.in/wp-content/uploads/2024/09/tech2509-10.jpg"
  },
  {
    name: "Wood Traffic LED Lights DIY Kit for Children Science and Technology Inventions",
    price: 300.00,
    image: "https://techtonics.in/wp-content/uploads/2023/05/tech2198-1.webp"
  }
];

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

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. Get the target Category ID (Educational Kits)
    const categoryRes = await client.query(
      "SELECT id FROM product_category WHERE handle = 'educational-kits';"
    );
    
    if (categoryRes.rows.length === 0) {
      throw new Error("Category 'Educational Kits' (educational-kits) was not found in the database. Please import categories first!");
    }
    
    const categoryId = categoryRes.rows[0].id;
    console.log(`Found 'Educational Kits' category ID: ${categoryId}`);

    console.log('Starting product import transaction...');
    await client.query('BEGIN');

    for (const prod of products) {
      const handle = slugify(prod.name);
      
      // Check if product already exists
      const checkRes = await client.query("SELECT id FROM product WHERE handle = $1;", [handle]);
      if (checkRes.rows.length > 0) {
        console.log(`[SKIP] Product "${prod.name}" already exists.`);
        continue;
      }

      // a. Insert Product
      const productId = generateId('prod');
      await client.query(`
        INSERT INTO product (
          id, title, handle, subtitle, description, is_giftcard, status, thumbnail, discountable, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());
      `, [
        productId,
        prod.name,
        handle,
        '', // subtitle
        `High-quality ${prod.name} designed for school lab education, student prototyping, and DIY projects.`,
        false, // is_giftcard
        'published', // status
        prod.image,
        true // discountable
      ]);

      // b. Link Product to Category
      await client.query(`
        INSERT INTO product_category_product (product_id, product_category_id)
        VALUES ($1, $2);
      `, [productId, categoryId]);

      // c. Create default Variant
      const variantId = generateId('variant');
      const sku = `EDU-KIT-${randomBytes(4).toString('hex').toUpperCase()}`;
      await client.query(`
        INSERT INTO product_variant (
          id, title, sku, manage_inventory, allow_backorder, product_id, created_at, updated_at, variant_rank
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 0);
      `, [
        variantId,
        'Default Variant',
        sku,
        false, // manage_inventory = false (always in stock)
        false, // allow_backorder
        productId
      ]);

      // d. Create Price Set container
      const priceSetId = generateId('pset');
      await client.query(`
        INSERT INTO price_set (id, created_at, updated_at)
        VALUES ($1, NOW(), NOW());
      `, [priceSetId]);

      // e. Link Variant to Price Set
      await client.query(`
        INSERT INTO product_variant_price_set (variant_id, price_set_id)
        VALUES ($1, $2);
      `, [variantId, priceSetId]);

      // f. Insert Price record (INR)
      const priceId = generateId('price');
      await client.query(`
        INSERT INTO price (
          id, price_set_id, currency_code, amount, raw_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW());
      `, [
        priceId,
        priceSetId,
        'inr',
        prod.price,
        JSON.stringify({ value: prod.price * 100, precision: 2 }) // stores in standard sub-unit (cents/paise)
      ]);

      console.log(`[CREATED] Product: "${prod.name}" | Price: ₹${prod.price} | SKU: ${sku}`);
    }

    await client.query('COMMIT');
    console.log('SUCCESS: All 23 products imported successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during product import. Database changes rolled back:', err);
  } finally {
    await client.end();
  }
}

main();
