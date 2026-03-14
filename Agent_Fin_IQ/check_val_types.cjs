
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
    const id = 'f6d20dfc-3869-4f3b-a86e-84999e8e4529';
    
    const res = await client.query('SELECT ocr_raw_payload FROM ap_invoices WHERE id = $1', [id]);
    const raw = res.rows[0].ocr_raw_payload;
    
    const targetKeys = [
      "buyer_verification",
      "gst_validation_status",
      "invoice_ocr_data_valdiation",
      "vendor_verification",
      "duplicate_check",
      "line_item_match_status"
    ];

    console.log('--- VALIDATION FIELDS DATA TYPES ---');
    targetKeys.forEach(key => {
        const val = raw[key];
        console.log(`${key}: ${JSON.stringify(val)} (${typeof val})`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
