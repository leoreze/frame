import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const relativePath = process.argv[2];
if (!relativePath) {
  console.error('Uso: node src/utils/run-sql.js database/init.sql');
  process.exit(1);
}

const filePath = path.resolve(__dirname, '../../', relativePath);
const sql = await fs.readFile(filePath, 'utf8');
await pool.query(sql);
await pool.end();
console.log(`SQL aplicado com sucesso: ${relativePath}`);
