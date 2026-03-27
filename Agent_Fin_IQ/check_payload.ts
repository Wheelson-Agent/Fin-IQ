
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './config/.env' });

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '10174'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(
      "SELECT id, invoice_number, ocr_raw_payload FROM ap_invoices WHERE invoice_number = '12658-24G02846' OR file_name LIKE '%12658-24G02846%' LIMIT 1;"
    );
    if (res.rows.length > 0) {
      const raw = typeof res.rows[0].ocr_raw_payload === 'string' 
        ? JSON.parse(res.rows[0].ocr_raw_payload) 
        : res.rows[0].ocr_raw_payload;
      console.log('Invoice:', res.rows[0].invoice_number);
      console.log('OCR Payload Keys:', Object.keys(raw));
      console.log('CGST %:', raw['CGST %'] || raw['cgst_pct'] || raw['CGST_Percentage']);
      console.log('SGST %:', raw['SGST %'] || raw['sgst_pct'] || raw['SGST_Percentage']);
      console.log('IGST %:', raw['IGST %'] || raw['igst_pct'] || raw['IGST_Percentage']);
    } else {
      console.log('Invoice not found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
