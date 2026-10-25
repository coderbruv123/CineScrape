#!/usr/bin/env node
// Fix the escaped backslashes in src/scraper/tfn.js
import fs from 'node:fs';
const path = new URL('./src/scraper/tfn.js', import.meta.url).pathname;
let content = fs.readFileSync(path, 'utf8');

// Fix all instances of double backslashes in regex literals
content = content.replace(
  /replace\('\/cinemas\/'\)/g,
  "replace('/cinemas/', '')"
);

// Fix the specific line with escaped backslashes
content = content.replace(
  /replace\('\/cinemas\/'\)\s*\.\s*replace\('\^\\\\\\\\+\/\+', ''\);/g,
  "replace('/cinemas/', '').replace(/^\\/+/, '');"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');
