import { listTasks } from '../packages/db/src/index.ts';

async function main() {
  try {
    const tasks = await listTasks({ role: 'veterinarian' });
    console.log(`Fetched ${tasks.length} tasks:`);
    console.log(JSON.stringify(tasks.slice(0, 5), null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
