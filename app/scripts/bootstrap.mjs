import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { createPool } from '../server/pool.mjs';
import { expectedColumns,checkSchema } from '../server/schema.mjs';

if(process.env.ALLOW_DEMO_BOOTSTRAP!=='true') throw new Error('Загрузка демо отключена. Для пустой учебной БД задайте ALLOW_DEMO_BOOTSTRAP=true');
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<12||password.includes('replace_')) throw new Error('Задайте DEMO_PASSWORD длиной от 12 символов');
if((process.env.DB_SCHEMA||'public')!=='public') throw new Error('Демо-инициализация поддерживает только public. Существующую схему подключайте без bootstrap.');
const pool=createPool();
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(45678123)");
  const existing=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",[Object.keys(expectedColumns)]);
  if(!existing.rows.length) await client.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8').then(s=>s.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')));
  await checkSchema(client,'public');
  for(const table of Object.keys(expectedColumns)) {
    const result=await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
    if(result.rows[0].n) throw new Error('База содержит данные. Bootstrap отказался изменять ее.');
  }
  const department=await client.query("INSERT INTO departments(name) VALUES('Учебное подразделение') RETURNING id");
  const roles=[['employee','Сотрудник'],['manager','Руководитель'],['accountant','Бухгалтер'],['coordinator','Координатор'],['admin','Администратор']];
  const ids={};
  for(const [code,name] of roles) ids[code]=(await client.query('INSERT INTO roles(code,name) VALUES($1,$2) RETURNING id',[code,name])).rows[0].id;
  const people=[
    ['employee@example.test','Учебный Сотрудник','Разработчик',['employee']],
    ['manager@example.test','Учебный Руководитель','Руководитель',['employee','manager']],
    ['accountant@example.test','Учебный Бухгалтер','Бухгалтер',['employee','accountant']],
    ['coordinator@example.test','Учебный Координатор','Координатор',['employee','coordinator']],
    ['admin@example.test','Учебный Администратор','Администратор',['admin']]
  ];
  const hash=await bcrypt.hash(password,12);
  for(const [index,[email,name,position,userRoles]] of people.entries()) {
    const user=(await client.query('INSERT INTO users(email,password_hash,is_active,created_at) VALUES($1,$2,true,now()) RETURNING id',[email,hash])).rows[0];
    await client.query('INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date) VALUES($1,$2,$3,$4,$5,current_date)',[user.id,department.rows[0].id,`DEMO-${index+1}`,name,position]);
    for(const role of userRoles) await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)',[user.id,ids[role]]);
  }
  for(const [code,name] of [['transport','Транспорт'],['hotel','Проживание'],['per_diem','Суточные'],['other','Другие расходы']]) await client.query('INSERT INTO expense_categories(code,name) VALUES($1,$2)',[code,name]);
  await client.query('COMMIT');
  console.log('Созданы 5 учебных учетных записей и 4 категории. Заявки создавайте через интерфейс.');
} catch(e) {await client.query('ROLLBACK');console.error(e.message);process.exitCode=1;}
finally {client.release();await pool.end();}
