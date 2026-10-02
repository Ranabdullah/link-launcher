const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (!args.length) { console.error('Pass a Wrangler command, such as whoami or login.'); process.exit(1); }
const cli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const env = { ...process.env, XDG_CONFIG_HOME: path.join(root, '.cloudflare-auth'), WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_ACCOUNT_ID: '2bd585fdb9252b0687c939a434d19886' };
const remoteMutation = !args.includes('--local') && !args.includes('--dry-run') && (
  args[0] === 'deploy' || args[0] === 'secret' || (args[0] === 'd1' && (args[1] === 'create' || args.includes('--remote')))
);
if (remoteMutation) {
  const check = spawnSync(process.execPath, [cli, 'whoami', '--json'], { cwd: root, env, encoding: 'utf8' });
  let identity; try { identity = JSON.parse(check.stdout); } catch {}
  if (check.status !== 0 || identity?.email !== 'abdullahinayat24@gmail.com' || !identity.accounts?.some(a => a.id === env.CLOUDFLARE_ACCOUNT_ID)) {
    console.error('Remote operation stopped: sign in as abdullahinayat24@gmail.com with access to the requested Cloudflare account.'); process.exit(1);
  }
}
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: root, stdio: 'inherit',
  env
});
process.exit(result.status ?? 1);
