import { createPool } from './pool.mjs';
import { checkSchema } from './schema.mjs';
const pool = createPool();
try {
  const columns = await checkSchema(pool,process.env.DB_SCHEMA || 'public');
  console.log(JSON.stringify({ compatible: true, columns },null,2));
  const { rows } = await pool.query(`SELECT c.relname AS table_name, con.conname,
    pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 ORDER BY c.relname,con.conname`, [process.env.DB_SCHEMA || 'public']);
  console.log(JSON.stringify({ constraints:rows },null,2));
} catch (e) { console.error(e.message); process.exitCode=1; }
finally { await pool.end(); }
