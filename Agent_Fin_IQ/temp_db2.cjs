const { Client } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('config/.env', 'utf8');
const lines = env.split('\n');
const config = {};
lines.forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key) config[key.trim()] = vals.join('=').trim().replace(/"/g, '');
});

const client = new Client({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoices'`))
    .then(res => {
        console.log(res.rows.map(r => r.column_name));
        return client.query(`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 1`);
    })
    .then(res => {
        console.log(JSON.stringify(res.rows[0], null, 2));
        client.end();
    })
    .catch(err => {
        console.error(err);
        client.end();
    });
