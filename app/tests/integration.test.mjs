import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.mjs';
import { checkSchema } from '../server/schema.mjs';
import { defaultStatuses } from '../server/domain.mjs';

test('Сквозной HTTP API и PostgreSQL-логика',async t=>{
  const db=new PGlite();let server;
  t.after(async()=>{if(server)await new Promise(r=>server.close(r));await db.close();});
  await db.exec(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const client={query:(sql,args=[])=>db.query(sql,args),release(){}};
  const pool={...client,connect:async()=>client};
  await checkSchema(pool,'public');
  await db.query("INSERT INTO departments(name) VALUES('Тестовый отдел')");
  const password='LocalTestPassword123';
  const hash=await bcrypt.hash(password,4); // ONLY isolated tests use the faster cost
  for(const [index,role] of ['employee','manager','accountant','coordinator'].entries()) {
    await db.query('INSERT INTO roles(code,name) VALUES($1,$2)',[role,role]);
    await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2)',[`${role}@example.test`,hash]);
    await db.query('INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date) VALUES($1,1,$2,$3,$4,current_date)',[index+1,`T${index+1}`,role,role]);
    await db.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[index+1,index+1]);
  }
  await db.query("INSERT INTO expense_categories(code,name) VALUES('transport','Транспорт')");
  const origin='http://localhost:3000';
  const app=createApp({pool,settings:{origin,statuses:defaultStatuses,secret:'isolated-test-session-secret-at-least-32-chars',secure:false,trustProxy:false},logger:()=>{}});
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(path,{method='GET',body,cookie,originHeader=origin}={}) {
    const headers={'Content-Type':'application/json'};if(originHeader)headers.Origin=originHeader;if(cookie)headers.Cookie=cookie;
    const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:response.status===204?null:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  const cookies={};
  for(const role of ['employee','manager','accountant','coordinator']) {
    const login=await call('/api/auth/login',{method:'POST',body:{email:`${role}@example.test`,password}});
    assert.equal(login.status,200,JSON.stringify(login.data));cookies[role]=login.cookie;
  }
  const draft={destination_country:'Россия',destination_city:'Казань',purpose:'Рабочая встреча с заказчиком',start_date:'2026-10-20',end_date:'2026-10-22',transport_type:'rail',accommodation_required:true,currency:'RUB',expenses:[{category_id:'1',amount:'100.10',description:'Билет'},{category_id:'1',amount:'200.20',description:'Обратный билет'}]};
  let requestId;
  await t.test('Без входа 401, чужой Origin 403',async()=>{
    assert.equal((await call('/api/requests')).status,401);
    assert.equal((await call('/api/requests',{method:'POST',body:draft,cookie:cookies.employee,originHeader:'https://untrusted.test'})).status,403);
  });
  await t.test('Создание заявки и точный итог расходов',async()=>{
    const r=await call('/api/requests',{method:'POST',body:draft,cookie:cookies.employee});
    assert.equal(r.status,201,JSON.stringify(r.data));requestId=r.data.id;
    const detail=await call(`/api/requests/${requestId}`,{cookie:cookies.employee});
    assert.equal(detail.status,200);assert.equal(Number(detail.data.estimated_total),300.30);
    assert.equal(detail.data.expenses.length,2);assert.equal(detail.data.history.length,1);
  });
  await t.test('Ошибка внешнего ключа откатывает всю транзакцию',async()=>{
    const before=await db.query('SELECT count(*)::int AS n FROM trips');
    const r=await call('/api/requests',{method:'POST',cookie:cookies.employee,body:{...draft,expenses:[{category_id:'999',amount:'1.00'}]}});
    assert.equal(r.status,400);assert.equal((await db.query('SELECT count(*)::int AS n FROM trips')).rows[0].n,before.rows[0].n);
  });
  await t.test('Ошибочная дата 400, чужой черновик 403',async()=>{
    assert.equal((await call('/api/requests',{method:'POST',cookie:cookies.employee,body:{...draft,end_date:'2026-10-19'}})).status,400);
    assert.equal((await call(`/api/requests/${requestId}`,{cookie:cookies.accountant})).status,403);
  });
  await t.test('Отправка сохраняет два шага и историю',async()=>{
    const r=await call(`/api/requests/${requestId}/submit`,{method:'POST',cookie:cookies.employee,body:{version:1,manager_id:'2',accountant_id:'3'}});
    assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.status,'in_approval');
    const detail=await call(`/api/requests/${requestId}`,{cookie:cookies.employee});
    assert.equal(detail.data.steps.length,2);assert.equal(detail.data.history.length,3);
  });
  await t.test('Редактирование и повторная отправка запрещены',async()=>{
    assert.equal((await call(`/api/requests/${requestId}`,{method:'PATCH',cookie:cookies.employee,body:{...draft,version:2}})).status,409);
    assert.equal((await call(`/api/requests/${requestId}/submit`,{method:'POST',cookie:cookies.employee,body:{version:2,manager_id:'2',accountant_id:'3'}})).status,409);
  });
  await t.test('Бухгалтер не пропускает руководителя',async()=>{
    assert.equal((await call(`/api/requests/${requestId}/decision`,{method:'POST',cookie:cookies.accountant,body:{version:2,decision:'approved'}})).status,403);
  });
  await t.test('Руководитель согласует первый шаг',async()=>{
    const r=await call(`/api/requests/${requestId}/decision`,{method:'POST',cookie:cookies.manager,body:{version:2,decision:'approved',comment:'Согласовано'}});
    assert.equal(r.status,200);assert.equal(r.data.status,'in_approval');assert.equal(r.data.version,3);
  });
  await t.test('Конфликт версии 409 и отсутствие причины 400',async()=>{
    assert.equal((await call(`/api/requests/${requestId}/decision`,{method:'POST',cookie:cookies.accountant,body:{version:2,decision:'approved'}})).status,409);
    assert.equal((await call(`/api/requests/${requestId}/decision`,{method:'POST',cookie:cookies.accountant,body:{version:3,decision:'rejected',comment:'нет'}})).status,400);
  });
  await t.test('Бухгалтер утверждает заявку',async()=>{
    const r=await call(`/api/requests/${requestId}/decision`,{method:'POST',cookie:cookies.accountant,body:{version:3,decision:'approved',comment:'Бюджет подтвержден'}});
    assert.equal(r.status,200);assert.equal(r.data.status,'approved');
  });
  await t.test('Завершение доступно координатору',async()=>{
    const body={version:4,comment:'Поездка завершена'};
    assert.equal((await call(`/api/requests/${requestId}/complete`,{method:'POST',cookie:cookies.employee,body})).status,403);
    assert.equal((await call(`/api/requests/${requestId}/complete`,{method:'POST',cookie:cookies.coordinator,body})).status,200);
    const detail=await call(`/api/requests/${requestId}`,{cookie:cookies.employee});
    assert.equal(detail.data.status,'completed');assert.equal(detail.data.history.length,5);
  });
  await t.test('Отклонение с причиной закрывает заявку',async()=>{
    const created=await call('/api/requests',{method:'POST',body:draft,cookie:cookies.employee});
    const rid=created.data.id;
    assert.equal((await call(`/api/requests/${rid}/submit`,{method:'POST',cookie:cookies.employee,body:{version:1,manager_id:'2',accountant_id:'3'}})).status,200);
    const r=await call(`/api/requests/${rid}/decision`,{method:'POST',cookie:cookies.manager,body:{version:2,decision:'rejected',comment:'Нет служебной необходимости'}});
    assert.equal(r.status,200);assert.equal(r.data.status,'rejected');
  });
  await t.test('Выход инвалидирует сессию',async()=>{
    assert.equal((await call('/api/auth/logout',{method:'POST',cookie:cookies.employee})).status,204);
    assert.equal((await call('/api/requests',{cookie:cookies.employee})).status,401);
  });
});
