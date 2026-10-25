/** Migration: ensure the SQLite schema exists (node:sqlite, no native deps).

  Used by:  npm run db:migrate
*/
import { initSchema } from './database.js';

initSchema();
console.log('Database schema initialized.');
