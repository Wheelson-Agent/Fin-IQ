import { query } from './backend/database/connection';
async function run() {
    try {
        const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ap_%'");
        for (const row of res.rows) {
            const table = row.table_name;
            const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
            console.log('--- ' + table + ' ---');
            cols.rows.forEach(c => console.log(c.column_name + ': ' + c.data_type));
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
