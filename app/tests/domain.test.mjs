import test from 'node:test';
import assert from 'node:assert/strict';
import { draftInput,decisionInput,parse,assertVersion,pendingStep,defaultStatuses } from '../server/domain.mjs';
const draft={destination_country:'Россия',destination_city:'Казань',purpose:'Рабочая встреча с заказчиком',start_date:'2026-10-20',end_date:'2026-10-22',transport_type:'rail',accommodation_required:true,currency:'RUB',expenses:[{category_id:'1',amount:'12500.10'}]};
test('Дата окончания раньше начала запрещена',()=>assert.throws(()=>parse(draftInput,{...draft,end_date:'2026-10-19'}),e=>e.status===400));
test('Невозможная календарная дата запрещена',()=>assert.throws(()=>parse(draftInput,{...draft,start_date:'2026-02-30'}),e=>e.status===400));
test('Отрицательные суммы и дробные копейки запрещены',()=>{
  for(const amount of ['-1','1.001','NaN','1e12']) assert.throws(()=>parse(draftInput,{...draft,expenses:[{category_id:'1',amount}]}),e=>e.status===400);
});
test('Денежная сумма передается без потери точности',()=>assert.equal(parse(draftInput,draft).expenses[0].amount,'12500.10'));
test('Устаревшая версия вызывает 409',()=>{
  assert.throws(()=>assertVersion({version:3},2),e=>e.status===409);
  assert.doesNotThrow(()=>assertVersion({version:3},3));
});
test('Второй шаг ожидает решение первого',()=>{
  const steps=[{id:1,status:'pending'},{id:2,status:'pending'}];
  assert.equal(pendingStep(steps,defaultStatuses).id,1);
  steps[0].status='approved';assert.equal(pendingStep(steps,defaultStatuses).id,2);
});
test('Причина отклонения обязательна',()=>assert.throws(()=>parse(decisionInput,{version:1,decision:'rejected',comment:'нет'}),e=>e.status===400));
