import { defaultStatuses } from './domain.mjs';

export function config(env=process.env) {
  const required = ['DATABASE_URL','REDIS_URL','SESSION_SECRET','APP_ORIGIN'];
  for (const key of required) if (!env[key]) throw new Error(`Не задана переменная ${key}`);
  if (env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.includes('replace_')) throw new Error('Задайте случайный SESSION_SECRET длиной не менее 32 символов');
  const schema = env.DB_SCHEMA || 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('Некорректное DB_SCHEMA');
  const origin = new URL(env.APP_ORIGIN).origin;
  const statuses = { ...defaultStatuses };
  for (const [key,name] of Object.entries({ draft:'STATUS_DRAFT',submitted:'STATUS_SUBMITTED',approval:'STATUS_APPROVAL',approved:'STATUS_APPROVED',rejected:'STATUS_REJECTED',completed:'STATUS_COMPLETED',stepPending:'STEP_PENDING',stepApproved:'STEP_APPROVED',stepRejected:'STEP_REJECTED' })) {
    if (env[name]) statuses[key] = env[name];
  }
  for (const s of Object.values(statuses)) if (!/^[a-zA-Z_]{1,20}$/.test(s)) throw new Error('Некорректное значение статуса');
  const mainStates = ['draft','submitted','approval','approved','rejected','completed'].map(k => statuses[k]);
  if (new Set(mainStates).size !== mainStates.length) throw new Error('Статусы заявок должны отличаться');
  return { schema, origin, statuses, secret: env.SESSION_SECRET, secure: env.COOKIE_SECURE === 'true', trustProxy: env.TRUST_PROXY === 'true' };
}
