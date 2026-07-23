const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'storefront', 'public', 'assets', 'js', 'main.min.js');
const content = fs.readFileSync(filePath, 'utf8');

// Find all indexes of 'RbtbottomTools'
let index = content.indexOf('RbtbottomTools');
let indexes = [];
while (index !== -1) {
    indexes.push(index);
    index = content.indexOf('RbtbottomTools', index + 1);
}

console.log("Found RbtbottomTools at indexes:", indexes);

indexes.forEach((idx, i) => {
    console.log(`--- Occurrence ${i + 1} ---`);
    console.log(content.substring(idx, idx + 1000));
});
