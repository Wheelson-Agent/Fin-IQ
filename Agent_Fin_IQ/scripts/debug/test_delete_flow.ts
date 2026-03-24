import { query } from '../../backend/database/connection';
import { deleteInvoice } from '../../backend/database/queries';

async function run() {
    try {
        console.log("Starting deletion test...");
        
        // 0. Create dummy company
        const companyRes = await query("INSERT INTO companies (name) VALUES ('Test Company') RETURNING id");
        const companyId = companyRes.rows[0].id;

        // 1. Create dummy invoice
        const invoiceRes = await query(
            "INSERT INTO ap_invoices (invoice_number, vendor_name, sub_total, grand_total, company_id, file_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            ['TEST-DELETE-999', 'Test Vendor', 100, 118, companyId, 'test_delete.pdf']
        );
        const invId = invoiceRes.rows[0].id;
        console.log(`Created Invoice ID: ${invId}`);

        // 2. Create lines and taxes
        await query("INSERT INTO ap_invoice_lines (ap_invoice_id, description, line_amount) VALUES ($1, $2, $3)", [invId, 'Test Line', 100]);
        await query("INSERT INTO ap_invoice_taxes (ap_invoice_id, tax_amount) VALUES ($1, $2)", [invId, 18]);

        // 3. Verify they exist
        const check1 = await query("SELECT count(*) FROM ap_invoice_lines WHERE ap_invoice_id = $1", [invId]);
        const check2 = await query("SELECT count(*) FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [invId]);
        console.log(`Initial state - Lines: ${check1.rows[0].count}, Taxes: ${check2.rows[0].count}`);

        // 4. Delete
        console.log("Calling deleteInvoice...");
        await deleteInvoice(invId);

        // 5. Verify they are gone
        const finalInv = await query("SELECT count(*) FROM ap_invoices WHERE id = $1", [invId]);
        const finalLines = await query("SELECT count(*) FROM ap_invoice_lines WHERE ap_invoice_id = $1", [invId]);
        const finalTaxes = await query("SELECT count(*) FROM ap_invoice_taxes WHERE ap_invoice_id = $1", [invId]);

        console.log(`Final state - Invoices: ${finalInv.rows[0].count}, Lines: ${finalLines.rows[0].count}, Taxes: ${finalTaxes.rows[0].count}`);
        
        if (finalInv.rows[0].count === '0' && finalLines.rows[0].count === '0' && finalTaxes.rows[0].count === '0') {
            console.log("SUCCESS: All related data deleted.");
        } else {
            console.log("FAILURE: Some data remains.");
        }

    } catch (e) {
        console.error("Test failed with error:", e);
    }
    process.exit(0);
}

run();
