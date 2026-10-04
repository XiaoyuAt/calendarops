// Run schema.sql against the DATABASE_URL from .env (one-off setup helper)
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const noComments = schema
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
const statements = noComments
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
for (const stmt of statements) {
  await sql(stmt);
  console.log('executed:', stmt.split('\n')[0].slice(0, 60));
}
const tables = await sql(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
console.log('tables in public schema:', tables.map((t) => t.table_name).join(', '));
