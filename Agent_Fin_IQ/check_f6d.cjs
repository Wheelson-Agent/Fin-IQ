
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
    
    console.log('--- INVOICE ---');
    const inv = await client.query('SELECT id, invoice_number, sub_total, tax_total, grand_total, doc_type, ocr_raw_payload FROM ap_invoices WHERE id = $1', [id]);
    console.log(JSON.stringify(inv.rows[0], null, 2));
    
    console.log('\n--- LINE ITEMS ---');
    const items = await client.query('SELECT * FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
    console.log(JSON.stringify(items.rows, null, 2));
    
    console.log('\n--- TAXES ---');
    const taxes = await client.query('SELECT * FROM ap_invoice_taxes WHERE ap_invoice_id = $1', [id]);
    console.log(JSON.stringify(taxes.rows, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
