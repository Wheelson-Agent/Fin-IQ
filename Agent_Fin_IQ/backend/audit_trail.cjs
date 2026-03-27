const { Client } = require('pg');
const client = new Client({
    user: 'avnadmin',
    host: 'wheelson-postgres-hyperready-aiven-wheelson.h.aivencloud.com',
    database: 'agent_tally',
    password: 'AVNS_NSEzMfT8oDd-BdyggXx',
    port: 10174,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT timestamp, event_type, user_name, description, before_data, after_data FROM audit_logs WHERE invoice_id = $1 ORDER BY timestamp DESC', ['8a050732-e77d-4e1b-8dbf-d6e82f47c109']);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Database Error:', err);
    } finally {
        await client.end();
    }
}

run();
