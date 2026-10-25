#!/usr/bin/env node
import fs from 'node:fs';
const path = new URL('./src/scraper/tfn.js', import.meta.url).pathname;
let content = fs.readFileSync(path, 'utf8');

// Fix the regex literal with extra slash
// Replace '/^\\/+//' with '/^\\\\/+/'
content = content.replace(/\/^\\\\+\/\/\//g, '/^\\\\/+/');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');
