import fs from 'fs';
import path from 'path';
import { ingestN8nData } from '../../backend/database/queries';
import { closePool } from '../../backend/database/connection';

async function reprocessLogs() {
    // Log is in parent directory relative to project root
    const logPath = path.resolve(process.cwd(), '../n8n_debug.log');
    
    if (!fs.existsSync(logPath)) {
        console.error('Log file not found at:', logPath);
        process.exit(1);
    }

    const content = fs.readFileSync(logPath, 'utf8');
    
    // Split by the separator used in the log
    const entries = content.split('--- N8N RESPONSE RECEIVED');
    console.log(`Found ${entries.length - 1} potential log entries.`);

    for (const entry of entries) {
        if (!entry.includes('Invoice ID:')) continue;

        try {
            // Extract Invoice ID
            const idMatch = entry.match(/Invoice ID: ([a-f0-9-]+)/);
            const invoiceId = idMatch ? idMatch[1] : null;

            // Extract JSON Response
            const jsonStart = entry.indexOf('Response: {');
            const jsonEnd = entry.lastIndexOf('------------------------------------------');
            
            if (invoiceId && jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = entry.substring(jsonStart + 10, jsonEnd).trim();
                const n8nData = JSON.parse(jsonStr);

                console.log(`Reprocessing Invoice: ${invoiceId}...`);
                await ingestN8nData(invoiceId, n8nData);
                console.log(`✅ Successfully updated: ${invoiceId}`);
            }
        } catch (err: any) {
            console.error(`❌ Failed to process entry: ${err.message}`);
        }
    }

    await closePool();
    console.log('\n--- Reprocess Complete ---');
}

reprocessLogs();
