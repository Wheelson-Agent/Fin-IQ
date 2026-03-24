
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
    const ids = [
      '65da146f-45e1-44a9-bc9d-ef110ec873fd',
      '492df6fa-948c-45de-88da-4adf36428828',
      '01930d0c-e5d7-4f6b-bf9a-6f4a427455ce'
    ];
    
    for (const id of ids) {
      console.log(`\n=== INVOICE: ${id} ===`);
      const invRes = await client.query('SELECT invoice_date, doc_type, ocr_raw_payload FROM ap_invoices WHERE id = $1', [id]);
      const lineRes = await client.query('SELECT description, gl_account_id, hsn_sac, quantity, unit_price, line_amount FROM ap_invoice_lines WHERE ap_invoice_id = $1', [id]);
      
      if (invRes.rows.length > 0) {
        const inv = invRes.rows[0];
        console.log('Main Record:');
        console.log(`  invoice_date (db): ${inv.invoice_date}`);
        console.log(`  doc_type: ${inv.doc_type}`);
        
        console.log('Lines in DB:');
        lineRes.rows.forEach(l => {
          console.log(`  - Desc: ${l.description}, LedgerID: ${l.gl_account_id}, HSN: ${l.hsn_sac}, Qty: ${l.quantity}, Rate: ${l.unit_price}`);
        });

        if (inv.ocr_raw_payload) {
            const raw = typeof inv.ocr_raw_payload === 'string' ? JSON.parse(inv.ocr_raw_payload) : inv.ocr_raw_payload;
            if (raw.line_items && raw.line_items.length > 0) {
                console.log('OCR Line Items (First Item):');
                console.log(`  - mapped_ledger: ${raw.line_items[0].mapped_ledger}`);
            }
        }
      } else {
        console.log('NOT FOUND');
      }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
