
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
    const res = await client.query('SELECT ocr_raw_payload FROM ap_invoices WHERE id = $1', [id]);
    const items = res.rows[0].ocr_raw_payload.line_items;
    
    if (items && items.length > 0) {
      console.log('--- LINE ITEM 0 ---');
      console.log(JSON.stringify(items[0], null, 2));
    } else {
      console.log('No line items found in OCR payload');
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
