import fs from 'fs';
const data = fs.readFileSync('scripts/output.json', 'utf16le');
console.log(data);
