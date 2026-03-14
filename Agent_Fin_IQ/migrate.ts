import { query, testConnection } from './backend/database/connection';
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log('Starting migration...');
    const ok = await testConnection();
    if (!ok) {
        console.error('DB Connection failed');
        process.exit(1);
    }

    const schemaPath = path.resolve(__dirname, 'backend/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    try {
        await query(schema);
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
    }
    process.exit(0);
}

migrate();
