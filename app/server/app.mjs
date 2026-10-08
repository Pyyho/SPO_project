import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError, parse, id, draftInput, submitInput, decisionInput, assertVersion, pendingStep } from './domain.mjs';

const privileged = ['admin','coordinator'];
const hasRole = (user,...roles) => roles.some(r => user.roles.includes(r));
const saveSession = req => new Promise((resolve,reject) => req.session.save(e => e ? reject(e) : resolve()));
const regenerate = req => new Promise((resolve,reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
const destroy = req => new Promise((resolve,reject) => req.session.destroy(e => e ? reject(e) : resolve()));

export function createApp({ pool, store, settings, redisPing=async()=>true, logger=entry=>console.log(JSON.stringify(entry)) }) {
  const app = express();
  const S = settings.statuses;
  app.disable('x-powered-by');
  if (settings.trustProxy) app.set('trust proxy',1);
  app.use(helmet());
  app.use((req,res,next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID',req.requestId);
    res.setHeader('Cache-Control','no-store');
    const started = Date.now();
    res.on('finish',() => logger({ time:new Date().toISOString(),request_id:req.requestId,method:req.method,path:req.path,status:res.statusCode,duration_ms:Date.now()-started }));
    next();
  });
  app.use(express.json({ limit:'64kb' }));
  app.get('/api/health',async(req,res) => {
    try { await pool.query('SELECT 1'); await redisPing(); res.json({status:'ok'}); }
    catch { res.status(503).json({status:'unavailable',request_id:req.requestId}); }
  });
  app.use(session({
    name:'trip.sid',store,secret:settings.secret,
    resave:false,saveUninitialized:false,
    cookie:{httpOnly:true,sameSite:'lax',secure:settings.secure,maxAge:8*60*60*1000,path:'/'}
  }));
  app.use((req,res,next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('Origin') !== settings.origin) {
      return next(new HttpError(403,'Недопустимый источник запроса'));
    }
    next();
  });
  async function userById(userId) {
    const { rows } = await pool.query(`SELECT u.id,u.email,e.id AS employee_id,e.full_name,e.department_id,
      COALESCE((SELECT array_agg(r.code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id),ARRAY[]::varchar[]) AS roles
      FROM users u JOIN employees e ON e.user_id=u.id WHERE u.id=$1 AND u.is_active=true`,[userId]);
    return rows[0];
  }
  app.post('/api/auth/login',rateLimit({ windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Слишком много попыток входа. Повторите позже.'} }),async(req,res) => {
    const input = parse(z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(200)}),req.body);
    const { rows } = await pool.query('SELECT id,password_hash,is_active FROM users WHERE lower(email)=lower($1)',[input.email]);
    const record = rows[0];
    // A fixed hash still performs a password check for unknown accounts.
    const valid = await bcrypt.compare(input.password,record?.password_hash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxitJUDrOEomPO5dfmF7KwUI55O');
    if (!record?.is_active || !valid) throw new HttpError(401,'Неверный email или пароль');
    const user = await userById(record.id);
    if (!user) throw new HttpError(403,'Для учетной записи отсутствует профиль сотрудника');
    await regenerate(req);
    req.session.userId = String(user.id);
    await saveSession(req);
    res.json({user,statuses:S});
  });
  app.post('/api/auth/logout',async(req,res) => {
    await destroy(req);
    res.clearCookie('trip.sid',{path:'/',httpOnly:true,sameSite:'lax',secure:settings.secure});
    res.status(204).end();
  });
  app.use(async(req,res,next) => {
    if (!req.session.userId) return next(new HttpError(401,'Войдите в систему'));
    try {
      req.user = await userById(req.session.userId);
      if (!req.user) { await destroy(req); throw new HttpError(401,'Учетная запись отключена'); }
      next();
    } catch(e) { next(e); }
  });
  app.get('/api/auth/me',(req,res) => res.json({user:req.user,statuses:S}));
  app.get('/api/lookups',async(req,res) => {
    const categories = await pool.query('SELECT id,code,name FROM expense_categories ORDER BY name');
    const approvers = await pool.query(`SELECT e.id,e.full_name,r.code AS role FROM employees e JOIN users u ON u.id=e.user_id
      JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.is_active=true AND r.code IN ('manager','accountant') AND e.id<>$1 ORDER BY e.full_name`,[req.user.employee_id]);
    res.json({categories:categories.rows,approvers:approvers.rows});
  });
  function visibility(user,alias='r') {
    return { sql:hasRole(user,...privileged) ? 'TRUE' : `(${alias}.employee_id=$1 OR EXISTS (SELECT 1 FROM approval_steps a WHERE a.request_id=${alias}.id AND a.approver_employee_id=$1))`,
      params:hasRole(user,...privileged) ? [] : [user.employee_id] };
  }
  function decorate(row) {
    const state = Object.entries(S).find(([key,value]) => !key.startsWith('step') && value===row.status)?.[0] || row.status;
    return { ...row,state };
  }
  app.get('/api/requests',async(req,res) => {
    const query = parse(z.object({status:z.string().max(20).optional(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}),req.query);
    const v = visibility(req.user);
    const params = [...v.params];
    const clauses=[v.sql];
    const bind=x=>{params.push(x);return `$${params.length}`;};
    if (query.status) {
      if (!['draft','submitted','approval','approved','rejected','completed'].includes(query.status)) throw new HttpError(400,'Неизвестный фильтр статуса');
      clauses.push(`r.status=${bind(S[query.status])}`);
    }
    if(query.from) clauses.push(`t.end_date>=${bind(query.from)}::date`);
    if(query.to) clauses.push(`t.start_date<=${bind(query.to)}::date`);
    const count = await pool.query(`SELECT count(*)::int AS total FROM travel_requests r JOIN trips t ON t.id=r.trip_id WHERE ${clauses.join(' AND ')}`,params);
    const offset=bind((query.page-1)*20);
    const result=await pool.query(`SELECT r.id,r.number,r.status,r.estimated_total,r.currency,r.version,e.full_name,
      t.destination_country,t.destination_city,to_char(t.start_date,'YYYY-MM-DD') AS start_date,to_char(t.end_date,'YYYY-MM-DD') AS end_date
      FROM travel_requests r JOIN trips t ON t.id=r.trip_id JOIN employees e ON e.id=r.employee_id
      WHERE ${clauses.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET ${offset}`,params);
    res.json({items:result.rows.map(decorate),total:count.rows[0].total,page:query.page,page_size:20});
  });
  async function loadRequest(client,requestId,user,lock=false) {
    const { rows } = await client.query(`SELECT * FROM travel_requests WHERE id=$1${lock?' FOR UPDATE':''}`,[requestId]);
    const record=rows[0];
    if(!record) throw new HttpError(404,'Заявка не найдена');
    if(String(record.employee_id)!==String(user.employee_id) && !hasRole(user,...privileged)) {
      const assigned=await client.query('SELECT 1 FROM approval_steps WHERE request_id=$1 AND approver_employee_id=$2',[requestId,user.employee_id]);
      if(!assigned.rows.length) throw new HttpError(403,'Нет доступа к заявке');
    }
    return record;
  }
  app.get('/api/requests/:id',async(req,res) => {
    const requestId=parse(id,req.params.id);
    const record=await loadRequest(pool,requestId,req.user);
    const trip=await pool.query(`SELECT *,to_char(start_date,'YYYY-MM-DD') AS start_date,to_char(end_date,'YYYY-MM-DD') AS end_date FROM trips WHERE id=$1`,[record.trip_id]);
    const expenses=await pool.query(`SELECT e.*,c.name AS category_name FROM expense_estimates e JOIN expense_categories c ON c.id=e.category_id WHERE request_id=$1 ORDER BY e.id`,[requestId]);
    const steps=await pool.query(`SELECT a.*,e.full_name FROM approval_steps a JOIN employees e ON e.id=a.approver_employee_id WHERE request_id=$1 ORDER BY step_order`,[requestId]);
    const history=await pool.query(`SELECT h.*,e.full_name FROM request_status_history h JOIN employees e ON e.id=h.changed_by_employee_id WHERE request_id=$1 ORDER BY changed_at,h.id`,[requestId]);
    const current=pendingStep(steps.rows,S);
    res.json({ ...decorate(record), trip:trip.rows[0],expenses:expenses.rows,steps:steps.rows,history:history.rows,
      can_edit:record.status===S.draft && String(record.employee_id)===String(req.user.employee_id),
      can_decide:record.status===S.approval && current?.status===S.stepPending && String(current.approver_employee_id)===String(req.user.employee_id),
      can_complete:record.status===S.approved && hasRole(req.user,'coordinator','admin') });
  });
  async function transaction(work) {
    const client=await pool.connect();
    try { await client.query('BEGIN'); const result=await work(client); await client.query('COMMIT'); return result; }
    catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  async function history(client,requestId,oldStatus,newStatus,actor,comment='') {
    await client.query(`INSERT INTO request_status_history(request_id,old_status,new_status,changed_by_employee_id,comment,changed_at) VALUES($1,$2,$3,$4,$5,now())`,[requestId,oldStatus,newStatus,actor,comment]);
  }
  async function writeExpenses(client,requestId,expenses) {
    await client.query('DELETE FROM expense_estimates WHERE request_id=$1',[requestId]);
    for(const e of expenses) await client.query('INSERT INTO expense_estimates(request_id,category_id,amount,description) VALUES($1,$2,$3,$4)',[requestId,e.category_id,e.amount,e.description]);
    await client.query(`UPDATE travel_requests SET estimated_total=(SELECT COALESCE(sum(amount),0) FROM expense_estimates WHERE request_id=$1) WHERE id=$1`,[requestId]);
  }
  app.post('/api/requests',async(req,res) => {
    const d=parse(draftInput,req.body);
    const result=await transaction(async c => {
      const trip=await c.query(`INSERT INTO trips(destination_country,destination_city,purpose,start_date,end_date,transport_type,accommodation_required,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`,[d.destination_country,d.destination_city,d.purpose,d.start_date,d.end_date,d.transport_type,d.accommodation_required]);
      const number=`TR-${randomUUID().replaceAll('-','').slice(0,24)}`;
      const request=await c.query(`INSERT INTO travel_requests(number,employee_id,trip_id,status,estimated_total,currency,employee_comment,created_at,updated_at,version) VALUES($1,$2,$3,$4,0,$5,$6,now(),now(),1) RETURNING id,version`,[number,req.user.employee_id,trip.rows[0].id,S.draft,d.currency,d.employee_comment]);
      const record=request.rows[0];
      await writeExpenses(c,record.id,d.expenses);
      await history(c,record.id,null,S.draft,req.user.employee_id,'Создан черновик');
      return record;
    });
    res.status(201).json(result);
  });
  app.patch('/api/requests/:id',async(req,res) => {
    const requestId=parse(id,req.params.id),d=parse(draftInput,req.body);
    if(!d.version) throw new HttpError(400,'Укажите версию заявки');
    const result=await transaction(async c => {
      const record=await loadRequest(c,requestId,req.user,true);
      if(String(record.employee_id)!==String(req.user.employee_id)) throw new HttpError(403,'Редактировать может только автор');
      assertVersion(record,d.version);
      if(record.status!==S.draft) throw new HttpError(409,'Редактирование доступно только для черновика');
      await c.query(`UPDATE trips SET destination_country=$1,destination_city=$2,purpose=$3,start_date=$4,end_date=$5,transport_type=$6,accommodation_required=$7 WHERE id=$8`,[d.destination_country,d.destination_city,d.purpose,d.start_date,d.end_date,d.transport_type,d.accommodation_required,record.trip_id]);
      await writeExpenses(c,requestId,d.expenses);
      const updated=await c.query(`UPDATE travel_requests SET currency=$1,employee_comment=$2,updated_at=now(),version=version+1 WHERE id=$3 RETURNING id,version`,[d.currency,d.employee_comment,requestId]);
      return updated.rows[0];
    });
    res.json(result);
  });
  app.post('/api/requests/:id/submit',async(req,res) => {
    const requestId=parse(id,req.params.id),d=parse(submitInput,req.body);
    const result=await transaction(async c => {
      const r=await loadRequest(c,requestId,req.user,true);
      if(String(r.employee_id)!==String(req.user.employee_id)) throw new HttpError(403,'Отправлять может только автор');
      assertVersion(r,d.version);
      if(r.status!==S.draft) throw new HttpError(409,'Заявка уже отправлена');
      if(d.manager_id===d.accountant_id || [d.manager_id,d.accountant_id].includes(String(req.user.employee_id))) throw new HttpError(400,'Согласующие должны отличаться друг от друга и от автора');
      for(const [employeeId,role] of [[d.manager_id,'manager'],[d.accountant_id,'accountant']]) {
        const valid=await c.query(`SELECT 1 FROM employees e JOIN users u ON u.id=e.user_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id WHERE e.id=$1 AND ro.code=$2 AND u.is_active=true`,[employeeId,role]);
        if(!valid.rows.length) throw new HttpError(400,'Согласующий неактивен или не имеет нужной роли');
      }
      const trip=await c.query(`SELECT t.*,to_char(t.start_date,'YYYY-MM-DD') AS start_date,to_char(t.end_date,'YYYY-MM-DD') AS end_date FROM trips t WHERE id=$1`,[r.trip_id]);
      const expenses=await c.query('SELECT category_id::text,amount::text,COALESCE(description,\'\') AS description FROM expense_estimates WHERE request_id=$1',[requestId]);
      parse(draftInput,{...trip.rows[0],currency:r.currency,employee_comment:r.employee_comment||'',expenses:expenses.rows});
      await c.query(`UPDATE travel_requests SET status=$1,submitted_at=now(),updated_at=now(),version=version+1 WHERE id=$2`,[S.submitted,requestId]);
      await history(c,requestId,S.draft,S.submitted,req.user.employee_id,'Заявка отправлена');
      await c.query(`INSERT INTO approval_steps(request_id,step_order,approver_employee_id,status,created_at) VALUES($1,1,$2,$3,now()),($1,2,$4,$3,now())`,[requestId,d.manager_id,S.stepPending,d.accountant_id]);
      await c.query(`UPDATE travel_requests SET status=$1 WHERE id=$2`,[S.approval,requestId]);
      await history(c,requestId,S.submitted,S.approval,req.user.employee_id,'Маршрут: руководитель, затем бухгалтер');
      return {id:requestId,status:S.approval,version:Number(r.version)+1};
    });
    res.json(result);
  });
  app.post('/api/requests/:id/decision',async(req,res) => {
    const requestId=parse(id,req.params.id),d=parse(decisionInput,req.body);
    const result=await transaction(async c => {
      const r=await loadRequest(c,requestId,req.user,true);
      assertVersion(r,d.version);
      if(r.status!==S.approval) throw new HttpError(409,'Заявка не ожидает согласования');
      const { rows:steps }=await c.query('SELECT * FROM approval_steps WHERE request_id=$1 ORDER BY step_order FOR UPDATE',[requestId]);
      const current=pendingStep(steps,S);
      if(!current || current.status!==S.stepPending) throw new HttpError(409,'Нет доступного шага согласования');
      if(String(current.approver_employee_id)!==String(req.user.employee_id)) throw new HttpError(403,'Сначала требуется решение предыдущего согласующего');
      if(!hasRole(req.user,Number(current.step_order)===1?'manager':'accountant')) throw new HttpError(403,'Роль согласующего была отозвана');
      const decision=d.decision==='approved'?S.stepApproved:S.stepRejected;
      await c.query('UPDATE approval_steps SET status=$1,decision_comment=$2,decided_at=now() WHERE id=$3',[decision,d.comment,current.id]);
      const final=d.decision==='rejected'?S.rejected:(steps.every(x=>String(x.id)===String(current.id)||x.status===S.stepApproved)?S.approved:S.approval);
      const updated=await c.query(`UPDATE travel_requests SET status=$1,updated_at=now(),version=version+1,decided_at=CASE WHEN $1=$2 THEN decided_at ELSE now() END WHERE id=$3 RETURNING id,status,version`,[final,S.approval,requestId]);
      if(final!==r.status) await history(c,requestId,r.status,final,req.user.employee_id,d.comment||'Все шаги согласованы');
      return updated.rows[0];
    });
    res.json(result);
  });
  app.post('/api/requests/:id/complete',async(req,res) => {
    if(!hasRole(req.user,'coordinator','admin')) throw new HttpError(403,'Операция доступна координатору');
    const requestId=parse(id,req.params.id),d=parse(z.object({version:z.number().int().positive(),comment:z.string().trim().min(5).max(2000)}),req.body);
    const result=await transaction(async c => {
      const r=await loadRequest(c,requestId,req.user,true);
      assertVersion(r,d.version);
      if(r.status!==S.approved) throw new HttpError(409,'Завершить можно только утвержденную поездку');
      const updated=await c.query('UPDATE travel_requests SET status=$1,updated_at=now(),version=version+1 WHERE id=$2 RETURNING id,status,version',[S.completed,requestId]);
      await history(c,requestId,r.status,S.completed,req.user.employee_id,d.comment);
      return updated.rows[0];
    });
    res.json(result);
  });
  app.use((req,res,next)=>next(new HttpError(404,'Маршрут не найден')));
  app.use((err,req,res,next)=>{
    let status=err.status||500;
    let message=err.status?err.message:'Внутренняя ошибка сервера';
    if(err.code==='23503') {status=400;message='Указана несуществующая категория или связь';}
    if(err.code==='23514'||err.code==='22P02'||err.code==='22007'||err.code==='22008'||err.code==='22003') {status=400;message='Данные не соответствуют ограничениям базы';}
    if(err.code==='23505') {status=409;message='Запись с таким ключом уже существует';}
    if(err.type==='entity.parse.failed') {status=400;message='Некорректный JSON';}
    if(err.type==='entity.too.large') {status=413;message='Слишком большой запрос';}
    logger({ time:new Date().toISOString(),request_id:req.requestId,event:'error',status,code:err.code||err.name });
    res.status(status).json({error:message,request_id:req.requestId});
  });
  return app;
}
