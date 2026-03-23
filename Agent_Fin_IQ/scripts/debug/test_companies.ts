
import { getSyncedCompanies } from '../../backend/database/queries.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'config/.env') });

async function test() {
    try {
        console.log('Fetching synced companies...');
        const result = await getSyncedCompanies();
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error fetching companies:', error);
    } finally {
        process.exit();
    }
}

test();
