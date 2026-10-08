import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const id = z.string().regex(/^[1-9]\d{0,18}$/).refine(x => BigInt(x) <= 9223372036854775807n);
const realDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s;
}, 'Некорректная календарная дата');
const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Сумма должна быть положительным числом с точностью до копеек');
export const draftInput = z.object({
  destination_country: z.string().trim().min(2).max(100),
  destination_city: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(10).max(5000),
  start_date: realDate,
  end_date: realDate,
  transport_type: z.enum(['rail','air','car','bus','other']),
  accommodation_required: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  employee_comment: z.string().trim().max(2000).default(''),
  expenses: z.array(z.object({ category_id: id, amount: money, description: z.string().trim().max(300).default('') })).min(1).max(30),
  version: z.number().int().positive().optional()
}).refine(x => x.end_date >= x.start_date, { message: 'Дата окончания раньше начала', path: ['end_date'] });
export const submitInput = z.object({
  version: z.number().int().positive(),
  manager_id: id,
  accountant_id: id
});
export const decisionInput = z.object({
  version: z.number().int().positive(),
  decision: z.enum(['approved','rejected']),
  comment: z.string().trim().max(2000).default('')
}).refine(x => x.decision !== 'rejected' || x.comment.length >= 5, { message: 'Укажите причину отклонения, минимум 5 символов', path: ['comment'] });
export function parse(schema, value) {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(400, r.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; '));
  return r.data;
}
export function assertVersion(record, version) {
  if (Number(record.version) !== version) throw new HttpError(409, 'Заявка изменилась. Обновите карточку и повторите действие.');
}
export function pendingStep(steps, statuses) {
  return steps.find(s => s.status !== statuses.stepApproved);
}
export const defaultStatuses = Object.freeze({
  draft: 'draft', submitted: 'submitted', approval: 'in_approval', approved: 'approved', rejected: 'rejected', completed: 'completed',
  stepPending: 'pending', stepApproved: 'approved', stepRejected: 'rejected'
});
