'use client';
import { useEffect,useState } from 'react';

const labels={draft:'Черновик',submitted:'Отправлена',approval:'На согласовании',approved:'Утверждена',rejected:'Отклонена',completed:'Завершена'};
const transport={rail:'Поезд',air:'Самолёт',car:'Автомобиль',bus:'Автобус',other:'Другое'};
const date=value=>value?new Date(value).toLocaleString('ru-RU'):'—';
const money=(value,currency)=>`${Number(value).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`;
const idString=x=>String(x);
const blank={destination_country:'Россия',destination_city:'',purpose:'',start_date:'',end_date:'',transport_type:'rail',accommodation_required:false,currency:'RUB',employee_comment:'',expenses:[]};

async function api(path,options={}) {
  const response=await fetch(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin'});
  const data=response.status===204?null:await response.json().catch(()=>({error:'Сервер вернул некорректный ответ'}));
  if(!response.ok) {const error=new Error(`${data?.error||'Ошибка запроса'}${data?.request_id?` (код ${data.request_id.slice(0,8)})`:''}`);error.status=response.status;throw error;}
  return data;
}

function DraftForm({initial,categories,busy,onSave,onCancel}) {
  const [form,setForm]=useState(initial);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const expenseChange=(index,key,value)=>setForm(f=>({...f,expenses:f.expenses.map((e,i)=>i===index?{...e,[key]:value}:e)}));
  return <form className="draft" onSubmit={e=>{e.preventDefault();onSave(form);}}>
    <div className="form-grid">
      <label>Страна<input required minLength={2} maxLength={100} value={form.destination_country} onChange={e=>change('destination_country',e.target.value)}/></label>
      <label>Город<input required minLength={2} maxLength={120} value={form.destination_city} onChange={e=>change('destination_city',e.target.value)}/></label>
      <label>Начало поездки<input required type="date" value={form.start_date} onChange={e=>change('start_date',e.target.value)}/></label>
      <label>Окончание<input required type="date" min={form.start_date} value={form.end_date} onChange={e=>change('end_date',e.target.value)}/></label>
      <label>Транспорт<select value={form.transport_type} onChange={e=>change('transport_type',e.target.value)}>{Object.entries(transport).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Валюта<select value={form.currency} onChange={e=>change('currency',e.target.value)}><option>RUB</option><option>USD</option><option>EUR</option></select></label>
    </div>
    <label>Служебная цель<textarea required minLength={10} maxLength={5000} rows={3} value={form.purpose} onChange={e=>change('purpose',e.target.value)} placeholder="Зачем нужна поездка и какой результат ожидается"/></label>
    <label className="check"><input type="checkbox" checked={form.accommodation_required} onChange={e=>change('accommodation_required',e.target.checked)}/>Требуется проживание</label>
    <h3>Предварительные расходы</h3>
    {!categories.length&&<p className="notice">Справочник категорий пуст. Администратору нужно заполнить expense_categories.</p>}
    {form.expenses.map((expense,index)=><div className="expense-row" key={index}>
      <label>Категория<select required value={expense.category_id} onChange={e=>expenseChange(index,'category_id',e.target.value)}><option value="">Выберите категорию</option>{categories.map(c=><option value={idString(c.id)} key={c.id}>{c.name}</option>)}</select></label>
      <label>Сумма<input required type="number" min="0" max="999999999999.99" step="0.01" value={expense.amount} onChange={e=>expenseChange(index,'amount',e.target.value)}/></label>
      <label>Описание<input maxLength={300} value={expense.description} onChange={e=>expenseChange(index,'description',e.target.value)}/></label>
      <button type="button" className="secondary" aria-label={`Удалить расход ${index+1}`} onClick={()=>change('expenses',form.expenses.filter((_,i)=>i!==index))}>Удалить</button>
    </div>)}
    <button className="secondary" type="button" disabled={form.expenses.length>=30} onClick={()=>change('expenses',[...form.expenses,{category_id:'',amount:'',description:''}])}>Добавить расход</button>
    <label>Комментарий<textarea rows={2} maxLength={2000} value={form.employee_comment} onChange={e=>change('employee_comment',e.target.value)}/></label>
    <div className="actions"><button type="submit" disabled={busy||!form.expenses.length||!categories.length}>{busy?'Сохранение…':'Сохранить черновик'}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Отмена</button></div>
  </form>;
}

export default function Page() {
  const [user,setUser]=useState(null),[statuses,setStatuses]=useState(null),[ready,setReady]=useState(false);
  const [login,setLogin]=useState({email:'',password:''});
  const [list,setList]=useState({items:[],total:0,page:1,page_size:20}),[lookups,setLookups]=useState({categories:[],approvers:[]});
  const [filters,setFilters]=useState({status:'',from:'',to:''}),[page,setPage]=useState(1),[loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(null),[editor,setEditor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [approvers,setApprovers]=useState({manager_id:'',accountant_id:''}),[comment,setComment]=useState('');
  useEffect(()=>{let active=true;api('/auth/me').then(d=>{if(active){setUser(d.user);setStatuses(d.statuses);}}).catch(e=>{if(active&&e.status!==401)setError(e.message);}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!user)return;
    let active=true;
    api('/lookups').then(d=>{if(active)setLookups(d);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[user]);
  async function loadList() {
    const q=new URLSearchParams({page:String(page)});
    Object.entries(filters).forEach(([k,v])=>{if(v)q.set(k,v);});
    const data=await api(`/requests?${q}`);setList(data);
  }
  useEffect(()=>{
    if(!user)return;
    let active=true;setLoading(true);
    const q=new URLSearchParams({page:String(page)});Object.entries(filters).forEach(([k,v])=>{if(v)q.set(k,v);});
    api(`/requests?${q}`).then(d=>{if(active)setList(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[user,filters,page]);
  async function perform(work,message) {
    if(busy)return;setBusy(true);setError('');setNotice('');
    try {await work();if(message)setNotice(message);}
    catch(e){setError(e.message);if(e.status===401){setUser(null);setSelected(null);setEditor(null);}}
    finally{setBusy(false);}
  }
  async function open(requestId) {
    await perform(async()=>{const d=await api(`/requests/${requestId}`);setSelected(d);setEditor(null);setComment('');setApprovers({manager_id:'',accountant_id:''});});
  }
  async function save(form) {
    await perform(async()=>{
      const existing=editor.id;
      const d=await api(existing?`/requests/${existing}`:'/requests',{method:existing?'PATCH':'POST',body:JSON.stringify(form)});
      const detail=await api(`/requests/${d.id}`);setSelected(detail);setEditor(null);await loadList();
    },'Черновик сохранён');
  }
  async function action(endpoint,payload,message) {
    await perform(async()=>{
      await api(`/requests/${selected.id}/${endpoint}`,{method:'POST',body:JSON.stringify({version:Number(selected.version),...payload})});
      setSelected(await api(`/requests/${selected.id}`));setComment('');await loadList();
    },message);
  }
  if(!ready)return <main><p role="status">Подключение к системе…</p></main>;
  if(!user)return <main className="login">
    <div className="eyebrow">СЛУЖЕБНЫЕ ПОЕЗДКИ</div><h1>Вход в систему</h1><p className="muted">Оформление заявок и последовательное согласование</p>
    {error&&<div role="alert" className="error">{error}</div>}
    <form onSubmit={e=>{e.preventDefault();perform(async()=>{const d=await api('/auth/login',{method:'POST',body:JSON.stringify(login)});setUser(d.user);setStatuses(d.statuses);setLogin({email:'',password:''});});}}>
      <label>Email<input type="email" required autoComplete="username" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/></label>
      <label>Пароль<input type="password" required autoComplete="current-password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label>
      <button disabled={busy}>{busy?'Вход…':'Войти'}</button>
    </form>
  </main>;
  return <>
    <header><div><span className="eyebrow">СЛУЖЕБНЫЕ ПОЕЗДКИ</span><strong>{user.full_name}</strong><span className="muted">{user.roles.join(', ')}</span></div><button className="secondary" disabled={busy} onClick={()=>perform(async()=>{await api('/auth/logout',{method:'POST'});setUser(null);setSelected(null);setEditor(null);setNotice('');})}>Выйти</button></header>
    <main>
      {error&&<div role="alert" className="error">{error}</div>}{notice&&<div role="status" className="notice">{notice}</div>}
      {editor?<section><h1>{editor.id?'Редактирование черновика':'Новая заявка'}</h1><DraftForm key={editor.id||'new'} initial={editor.form} categories={lookups.categories} busy={busy} onSave={save} onCancel={()=>setEditor(null)}/></section>:selected?<section>
        <button className="secondary" disabled={busy} onClick={()=>{setSelected(null);setError('');}}>К списку заявок</button>
        <div className="title-row"><h1>{selected.number}</h1><span className={`status ${selected.state}`}>{labels[selected.state]||selected.status}</span></div>
        <h2>{selected.trip.destination_city}, {selected.trip.destination_country}</h2>
        <p>{selected.trip.start_date} — {selected.trip.end_date} · {transport[selected.trip.transport_type]||selected.trip.transport_type}</p>
        <p className="purpose">{selected.trip.purpose}</p><p>Проживание: {selected.trip.accommodation_required?'требуется':'не требуется'}</p>
        {selected.employee_comment&&<p>Комментарий: {selected.employee_comment}</p>}
        <h3>Предварительные расходы</h3><div className="table-wrap"><table><thead><tr><th>Категория</th><th>Описание</th><th>Сумма</th></tr></thead><tbody>{selected.expenses.map(e=><tr key={e.id}><td>{e.category_name}</td><td>{e.description||'—'}</td><td>{money(e.amount,selected.currency)}</td></tr>)}</tbody></table></div>
        <p className="total">Итого: {money(selected.estimated_total,selected.currency)}</p>
        {selected.can_edit&&<div className="operation">
          <button disabled={busy} className="secondary" onClick={()=>setEditor({id:selected.id,form:{...selected.trip,currency:selected.currency,employee_comment:selected.employee_comment||'',version:Number(selected.version),expenses:selected.expenses.map(e=>({...e,category_id:idString(e.category_id),amount:String(e.amount),description:e.description||''}))}})}>Редактировать</button>
          <h3>Отправка на согласование</h3><div className="form-grid">
            <label>Руководитель<select required value={approvers.manager_id} onChange={e=>setApprovers({...approvers,manager_id:e.target.value})}><option value="">Выберите руководителя</option>{lookups.approvers.filter(a=>a.role==='manager').map(a=><option key={a.id} value={idString(a.id)}>{a.full_name}</option>)}</select></label>
            <label>Бухгалтер<select required value={approvers.accountant_id} onChange={e=>setApprovers({...approvers,accountant_id:e.target.value})}><option value="">Выберите бухгалтера</option>{lookups.approvers.filter(a=>a.role==='accountant').map(a=><option key={a.id} value={idString(a.id)}>{a.full_name}</option>)}</select></label>
          </div><button disabled={busy||!approvers.manager_id||!approvers.accountant_id} onClick={()=>action('submit',approvers,'Заявка отправлена на согласование')}>Отправить заявку</button>
        </div>}
        <h3>Маршрут согласования</h3>{!selected.steps.length?<p className="muted">Маршрут появится после отправки заявки.</p>:<ol className="steps">{selected.steps.map(s=><li key={s.id}><strong>{s.full_name}</strong> — {s.status===statuses.stepApproved?'Согласовано':s.status===statuses.stepRejected?'Отклонено':'Ожидает'}{s.decision_comment&&<p>{s.decision_comment}</p>}{s.decided_at&&<small>{date(s.decided_at)}</small>}</li>)}</ol>}
        {selected.can_decide&&<div className="operation"><h3>Ваше решение</h3><label>Комментарий<textarea rows={3} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Причина отклонения обязательна"/></label><div className="actions"><button disabled={busy} onClick={()=>action('decision',{decision:'approved',comment},'Решение сохранено')}>Согласовать</button><button className="danger" disabled={busy||comment.trim().length<5} onClick={()=>action('decision',{decision:'rejected',comment},'Заявка отклонена')}>Отклонить</button></div></div>}
        {selected.can_complete&&<div className="operation"><h3>Завершение поездки</h3><label>Комментарий<textarea rows={2} value={comment} maxLength={2000} onChange={e=>setComment(e.target.value)}/></label><button disabled={busy||comment.trim().length<5} onClick={()=>action('complete',{comment},'Поездка завершена')}>Завершить поездку</button></div>}
        <h3>История статусов</h3><ol className="steps">{selected.history.map(h=><li key={h.id}><strong>{h.full_name}</strong> · {date(h.changed_at)}<p>{h.old_status||'Создание'} → {h.new_status}{h.comment?` · ${h.comment}`:''}</p></li>)}</ol>
        <button disabled={busy} className="secondary" onClick={()=>open(selected.id)}>Обновить карточку</button>
      </section>:<section>
        <div className="title-row"><div><h1>Заявки на поездки</h1><p className="muted">Доступны ваши заявки и назначенные вам согласования</p></div><button disabled={busy} onClick={()=>{setError('');setEditor({form:{...blank,expenses:[{category_id:'',amount:'',description:''}]}});}}>Новая заявка</button></div>
        <div className="filters"><label>Статус<select value={filters.status} onChange={e=>{setPage(1);setFilters({...filters,status:e.target.value});}}><option value="">Все</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Поездки с<input type="date" value={filters.from} onChange={e=>{setPage(1);setFilters({...filters,from:e.target.value});}}/></label><label>По<input type="date" value={filters.to} onChange={e=>{setPage(1);setFilters({...filters,to:e.target.value});}}/></label><button className="secondary" disabled={busy||loading} onClick={()=>perform(loadList)}>Обновить</button></div>
        {loading?<p role="status">Загрузка заявок…</p>:!list.items.length?<div className="empty"><h2>Заявок пока нет</h2><p>Создайте первую заявку или измените фильтры.</p></div>:<div className="table-wrap"><table><thead><tr><th>Заявка</th><th>Сотрудник</th><th>Поездка</th><th>Даты</th><th>Статус</th><th>Бюджет</th></tr></thead><tbody>{list.items.map(r=><tr key={r.id}><td><button className="link" disabled={busy} onClick={()=>open(r.id)}>{r.number}</button></td><td>{r.full_name}</td><td>{r.destination_city}, {r.destination_country}</td><td>{r.start_date}<br/>{r.end_date}</td><td><span className={`status ${r.state}`}>{labels[r.state]||r.status}</span></td><td>{money(r.estimated_total,r.currency)}</td></tr>)}</tbody></table></div>}
        <div className="pagination"><span>Всего: {list.total} · Страница {page}</span><button className="secondary" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Назад</button><button className="secondary" disabled={loading||page*20>=list.total} onClick={()=>setPage(p=>p+1)}>Далее</button></div>
      </section>}
    </main>
  </>;
}
