import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { createPool } from './pool.mjs';
import { config } from './config.mjs';
import { checkSchema } from './schema.mjs';
import { createApp } from './app.mjs';

const settings=config();
const pool=createPool();
const redis=createClient({url:process.env.REDIS_URL});
redis.on('error',()=>console.error(JSON.stringify({event:'redis_error',time:new Date().toISOString()})));
pool.on('error',()=>console.error(JSON.stringify({event:'database_error',time:new Date().toISOString()})));
try {
  await checkSchema(pool,settings.schema);
  await redis.connect();
  const app=createApp({pool,store:new RedisStore({client:redis,prefix:'trip:session:'}),settings,redisPing:()=>redis.ping()});
  const server=app.listen(Number(process.env.API_PORT||3001),process.env.API_HOST||'127.0.0.1',()=>console.log(JSON.stringify({event:'api_started',port:Number(process.env.API_PORT||3001)})));
  let stopping=false;
  const shutdown=()=>{
    if(stopping) return;
    stopping=true;
    const timer=setTimeout(()=>process.exit(1),15000);timer.unref();
    server.close(async()=>{await Promise.allSettled([pool.end(),redis.quit()]);clearTimeout(timer);process.exit(0);});
  };
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
} catch(e) {
  // Schema differences are safe to print. Never print a driver URL or connection error.
  console.error(e.message.startsWith('Схема несовместима')?e.message:'Не удалось запустить API. Проверьте PostgreSQL, Redis и переменные окружения.');
  await pool.end();
  if(redis.isOpen) await redis.quit();
  process.exitCode=1;
}
