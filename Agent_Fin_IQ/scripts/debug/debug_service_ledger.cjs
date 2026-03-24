
const { Client } = require('pg');

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
    const id = '8a206b08-1d61-4385-9154-8cf59ea071ed';
    const res = await client.query('SELECT ocr_raw_payload, n8n_val_json_data FROM ap_invoices WHERE id = $1', [id]);
    const raw = res.rows[0].ocr_raw_payload;
    const n8n = typeof res.rows[0].n8n_val_json_data === 'string' 
                ? JSON.parse(res.rows[0].n8n_val_json_data) 
                : res.rows[0].n8n_val_json_data;
    
    console.log('--- OCR KEYS ---');
    console.log(Object.keys(raw));
    
    if (n8n) {
      console.log('\n--- N8N KEYS ---');
      console.log(Object.keys(n8n));
      console.log('\n--- N8N MAPPED LEDGER ---');
      console.log('mapped_ledger:', n8n.mapped_ledger);
      console.log('Mapped_Ledger:', n8n.Mapped_Ledger);
      console.log('Mapped Ledger:', n8n['Mapped Ledger']);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
