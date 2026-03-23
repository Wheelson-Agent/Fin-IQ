
import { query } from '../../backend/database/connection';
import { ingestN8nData } from '../../backend/database/queries';

const userExample = [
  {
    "table_config": {
      "vendors": true,
      "ap_invoices": true,
      "ap_invoice_lines": true,
      "ap_invoice_taxes": true
    },
    "vendors": [
      {
        "name": "KAPP NILES INDIA TECHNOLOGIES PVT. LTD.",
        "gstin": "29AAHCK9089R1Z7"
      }
    ],
    "ap_invoices": [
      {
        "id": null,
        "invoice_number": "KNI/S-116/2024",
        "invoice_date": "2025-01-09",
        "sub_total": 141772,
        "tax_total": 0,
        "grand_total": 167291,
        "processing_status": "Verified",
        "file_name": "13090-24G03031_page-0002.jpg",
        "vendor_name": "KAPP NILES INDIA TECHNOLOGIES PVT. LTD.",
        "vendor_gst": "29AAHCK9089R1Z7",
        "n8n_validation_status": "True",
        "doc_type": "goods",
        "n8n_val_json_data": {
          "invoice_ocr_data_valdiation": "True",
          "document_type_check": null,
          "gst_validation_status": false,
          "buyer_verification": true,
          "duplicate_check": true,
          "vendor_verification": true,
          "line_item_match_status": false
        }
      }
    ],
    "ap_invoice_lines": [
      {
        "line_number": 1,
        "description": "Service Support towards Calibration on KAPP KNM2X Machine Sr. No. KN-058 for 3 Days. From 16-12-2024 to 18-12-2024",
        "quantity": 2,
        "unit_price": 70886,
        "line_amount": 141772,
        "hsn_sac": "9954"
      }
    ],
    "ap_invoice_taxes": [
      {
        "tax_code": "CGST9",
        "tax_amount": 12759.48,
        "base_amount": 141772
      },
      {
        "tax_code": "SGST9",
        "tax_amount": 12759.48,
        "base_amount": 141772
      }
    ]
  }
];

async function run() {
    try {
        const res = await query("SELECT id FROM ap_invoices WHERE file_name = '13090-24G03031_page-0002.jpg' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("Record not found for 13090-24G03031_page-0002.jpg");
            return;
        }
        const id = res.rows[0].id;
        console.log(`Found ID: ${id}. Ingesting user data for KAPP NILES...`);
        await ingestN8nData(id, userExample);
        console.log("SUCCESS");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
