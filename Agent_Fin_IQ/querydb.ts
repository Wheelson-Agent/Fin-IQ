import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "./config/.env" });
const pool = new Pool();
pool.query("SELECT id, status, pre_ocr_status, failure_reason FROM invoices ORDER BY id DESC LIMIT 1")
    .then(res => console.log(res.rows))
    .finally(() => process.exit(0));
