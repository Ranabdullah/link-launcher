const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
async function main() {
  const action = process.argv[2];
  if (!['freeze', 'status', 'resume'].includes(action)) throw new Error('Choose freeze, status or resume.');
  const connectionString = process.env.DATABASE_URL || fs.readFileSync(path.join(root, 'migration-private/render-database-url.txt'), 'utf8').trim();
  const source = new URL(connectionString);
  if (source.hostname !== 'dpg-dajgev7qj5pc73dhjbgg-a.oregon-postgres.render.com' || source.pathname !== '/dreamslab_vault') throw new Error('Unexpected source database; refusing to change it.');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    if (action === 'freeze') {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query(`CREATE OR REPLACE FUNCTION dl_cloudflare_migration_freeze() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'This vault has moved to https://link-launcher.ranakaharian1.workers.dev. Old cloud storage is read-only.'; END $$`);
      const existing = await client.query("SELECT 1 FROM pg_trigger WHERE tgname = 'dl_cloudflare_migration_freeze' AND tgrelid = 'users'::regclass");
      if (!existing.rowCount) await client.query('CREATE TRIGGER dl_cloudflare_migration_freeze BEFORE INSERT OR UPDATE OR DELETE ON users FOR EACH STATEMENT EXECUTE FUNCTION dl_cloudflare_migration_freeze()');
      await client.query('COMMIT');
    }
    if (action === 'resume') {
      await client.query('BEGIN');
      await client.query('DROP TRIGGER IF EXISTS dl_cloudflare_migration_freeze ON users');
      await client.query('DROP FUNCTION IF EXISTS dl_cloudflare_migration_freeze()');
      await client.query('COMMIT');
    }
    const status = await client.query("SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dl_cloudflare_migration_freeze' AND tgrelid = 'users'::regclass AND tgenabled <> 'D') AS frozen, (SELECT COUNT(*)::int FROM users) AS accounts");
    console.log(JSON.stringify({ source: 'render-postgres', ...status.rows[0] }));
  } finally { await client.end(); }
}
main().catch(() => { console.error('Source operation failed. No credentials were printed; inspect the source privately before proceeding.'); process.exitCode = 1; });
