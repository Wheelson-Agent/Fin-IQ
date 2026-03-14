
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, 'Agent_Fin_IQ/config/.env');
console.log('Checking env at:', envPath);
console.log('Exists:', fs.existsSync(envPath));

dotenv.config({ path: envPath });
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
