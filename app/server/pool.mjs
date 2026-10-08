import pg from 'pg';
export function createPool(env=process.env) {
  const schema = env.DB_SCHEMA || 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('Некорректное DB_SCHEMA');
  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    options: `-c search_path=${schema} -c statement_timeout=10000`,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });
}
