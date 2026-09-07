const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { execSync } = require('child_process');

async function runMigration() {
  console.log('[Migration] Starting PostgreSQL schema migration on Aurora Serverless v2...');
  const host = 'browserpilot-prod-aurora.cluster-cxeiuyo66ysk.ap-south-2.rds.amazonaws.com';
  const user = 'postgres';
  const port = 5432;
  const database = 'postgres';

  const awsCli = 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe';
  const token = execSync(`"${awsCli}" rds generate-db-auth-token --hostname ${host} --port ${port} --region ap-south-2 --username ${user}`, { encoding: 'utf8' }).trim();

  const client = new Client({
    host,
    port,
    user,
    password: token,
    database,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[Migration] Connected to database: ' + database);

  const sqlPath = path.join(__dirname, 'postgres-migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('[Migration] Executing DDL migration script...');
  await client.query(sql);
  console.log('[Migration] Schema migration DDL executed successfully!');

  // Verify created tables
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`[Migration] Tables created in public schema (${res.rows.length}):`);
  res.rows.forEach(r => console.log(' - ' + r.table_name));

  await client.end();
  console.log('[Migration] Complete!');
}

runMigration().catch(err => {
  console.error('[Migration ERROR]', err);
  process.exit(1);
});
