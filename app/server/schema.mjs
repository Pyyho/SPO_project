export const expectedColumns = {
  departments: ['id','name'],
  users: ['id','email','password_hash','is_active','created_at'],
  roles: ['id','code','name'],
  user_roles: ['user_id','role_id'],
  employees: ['id','user_id','department_id','employee_number','full_name','position','phone','hire_date'],
  trips: ['id','destination_country','destination_city','purpose','start_date','end_date','transport_type','accommodation_required','created_at'],
  travel_requests: ['id','number','employee_id','trip_id','status','estimated_total','currency','employee_comment','submitted_at','decided_at','created_at','updated_at','version'],
  request_status_history: ['id','request_id','old_status','new_status','changed_by_employee_id','comment','changed_at'],
  approval_steps: ['id','request_id','step_order','approver_employee_id','status','decision_comment','decided_at','created_at'],
  expense_categories: ['id','code','name'],
  expense_estimates: ['id','request_id','category_id','amount','description']
};
export async function checkSchema(pool, schema) {
  const { rows } = await pool.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position`, [schema]);
  const missing = [];
  for (const [table,cols] of Object.entries(expectedColumns)) {
    for (const col of cols) if (!rows.some(r => r.table_name === table && r.column_name === col)) missing.push(`${table}.${col}`);
  }
  if (missing.length) throw new Error(`Схема несовместима со скриншотом. Не найдены: ${missing.join(', ')}`);
  return rows.filter(r => expectedColumns[r.table_name]);
}
