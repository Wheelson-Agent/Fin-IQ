
const { Client } = require('pg');
const fs = require('fs');

const config = {
  host: "wheelson-postgres-hyperready-aiven-wheelson.h.aivencloud.com",
  port: 10174,
  user: "avnadmin",
  password: "AVNS_NSEzMfT8oDd-BdyggXx",
  database: "agent_tally",
  ssl: {
    rejectUnauthorized: false
  }
};

async function run() {
  const client = new Client(config);
  try {
    await client.connect();
    const id = 'f6d20dfc-3869-4f3b-a86e-84999e8e4529';
    const res = await client.query('SELECT ocr_raw_payload, n8n_val_json_data FROM ap_invoices WHERE id = $1', [id]);
    
    const result = {
        ocr_raw_payload: res.rows[0].ocr_raw_payload,
        n8n_val_json_data: typeof res.rows[0].n8n_val_json_data === 'string' 
            ? JSON.parse(res.rows[0].n8n_val_json_data) 
            : res.rows[0].n8n_val_json_data
    };
    
    fs.writeFileSync('debug_dump.json', JSON.stringify(result, null, 2));
    console.log('Dumped to debug_dump.json');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
