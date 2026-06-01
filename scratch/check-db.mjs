import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const tasks = await sql`select id, status, client_name, pet_name, request, created_at from tasks limit 10`;
    console.log("TASKS:");
    console.log(JSON.stringify(tasks, null, 2));

    const approvals = await sql`select id, status, title, summary, created_at from approvals limit 10`;
    console.log("APPROVALS:");
    console.log(JSON.stringify(approvals, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
