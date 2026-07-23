const fs = require('fs');
const readline = require('readline');

const csvPath = 'c:\\Users\\dilli\\Downloads\\medusa\\my-electronics-store\\techtonics_products.csv';

async function main() {
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const categories = new Set();
  const types = new Set();
  let count = 0;

  for await (const line of rl) {
    count++;
    if (count === 1) continue; // skip header
    const parts = line.split(',');
    if (parts.length >= 2) {
      categories.add(parts[0]);
      types.add(parts[1]);
    }
  }

  console.log('Total Rows in CSV:', count);
  console.log('\nUnique Categories found:', [...categories]);
  console.log('\nUnique Category Types found:', [...types]);
}

main();
