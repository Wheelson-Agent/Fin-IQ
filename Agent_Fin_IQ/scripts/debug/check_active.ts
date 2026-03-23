
import { query } from '../../backend/database/connection.ts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, 'config/.env') });

async function test() {
    try {
        console.log('Fetching all companies with all columns...');
        const { rows } = await query('SELECT * FROM companies');
        console.log('Result:', JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('Error fetching companies:', error);
    } finally {
        process.exit();
    }
}

test();
