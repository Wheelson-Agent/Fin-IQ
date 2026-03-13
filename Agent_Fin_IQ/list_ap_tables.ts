import { query } from './backend/database/connection';
async function run() {
    const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ap%'");
    console.log(res.rows.map(r => r.table_name));
    process.exit(0);
}
run();
