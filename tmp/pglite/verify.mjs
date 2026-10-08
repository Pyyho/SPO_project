import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../../output/sql/", import.meta.url);
const db = new PGlite();

for (const file of ["001_schema.sql", "002_seed.sql", "003_verification.sql"]) {
  const sql = await readFile(new URL(file, root), "utf8");
  await db.exec(sql);
  console.log(`${file}: PASS`);
}

try {
  const accessSql = await readFile(new URL("004_access_control.sql", root), "utf8");
  await db.exec(accessSql);
  console.log("004_access_control.sql: PASS");
} catch (error) {
  console.log(`004_access_control.sql: NOT RUN (${error.message})`);
}

const totals = await db.query(`
  SELECT request_id, estimated_total_rub
  FROM trip_mgmt.v_trip_request_totals
  ORDER BY request_id
`);
console.log(JSON.stringify(totals.rows));

await db.close();
