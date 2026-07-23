const fs = require('fs');
const readline = require('readline');

const csvPath = 'c:\\Users\\dilli\\Downloads\\medusa\\my-electronics-store\\techtonics_products.csv';

async function main() {
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  console.log('Sample rows where Category Type is Subcategory:');
  
  for await (const line of rl) {
    const parts = line.split(',');
    if (parts[1] === 'Subcategory') {
      console.log(line);
      count++;
      if (count >= 20) break;
    }
  }
}

main();
