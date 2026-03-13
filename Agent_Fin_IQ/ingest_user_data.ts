
import { query } from './backend/database/connection';
import { ingestN8nData } from './backend/database/queries';

const userExample = [
  {
    "table_config": {
      "vendors": false,
      "ap_invoices": true,
      "ap_invoice_lines": true,
      "ap_invoice_taxes": true
    },
    "vendors": [],
    "ap_invoices": [
      {
        "id": null,
        "company_id": null,
        "vendor_id": null,
        "purchase_order_id": null,
        "invoice_number": "8290006685",
        "invoice_date": "2025-01-02",
        "due_date": null,
        "sub_total": 295800,
        "tax_total": 53244,
        "grand_total": 349044,
        "currency_id": null,
        "processing_status": "Verified",
        "file_name": "GST amount not capctured.jpg",
        "vendor_name": "FANUC India Private Limited",
        "po_number": "815613",
        "n8n_validation_status": "True",
        "vendor_gst": "29AAACF2773N1Z6",
        "irn": "f0234c1d99bdd0a6c853f97e41c26e d3c9",
        "ack_no": "112523260103879",
        "ack_date": "2025-01-02"
      }
    ],
    "ap_invoice_lines": [
      {
        "line_number": 1,
        "description": "FANUC CNC System Package consist of, BiSc4,BiSv20",
        "quantity": 1,
        "unit_price": 146400,
        "line_amount": 172752,
        "hsn_sac": "85371000",
        "order_no": "815613"
      },
      {
        "line_number": 2,
        "description": "FANUC CNC System Package consist of, B8iSc, BiSv20",
        "quantity": 1,
        "unit_price": 149400,
        "line_amount": 176292,
        "hsn_sac": "85371000",
        "order_no": "815613"
      }
    ],
    "ap_invoice_taxes": []
  }
];

async function run() {
    try {
        const res = await query("SELECT id FROM ap_invoices WHERE file_name = 'GST amount not capctured.jpg' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("Record not found");
            return;
        }
        const id = res.rows[0].id;
        console.log(`Found ID: ${id}. Ingesting user data...`);
        await ingestN8nData(id, userExample);
        console.log("SUCCESS");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
