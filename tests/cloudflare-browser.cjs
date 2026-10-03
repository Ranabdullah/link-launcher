const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
(async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ name:'browser-test', host:'127.0.0.1', port:0, modules:true, scriptPath:path.resolve('cloudflare/worker.mjs'),compatibilityDate:'2026-10-01',
    d1Databases:['DB'],bindings:{JWT_SECRET:crypto.randomBytes(32).toString('hex'),MIGRATION_PENDING:'false'},
    assets:{directory:path.resolve('web-dist'),binding:'ASSETS',run_worker_first:['/api/*'],routerConfig:{has_user_worker:true}},
    ratelimits:Object.fromEntries(['AUTH_LIMIT','LOGIN_LIMIT','REGISTER_LIMIT'].map((name,i)=>[name,{namespace_id:String(i+1),simple:{limit:60,period:60}}]))
  }));
  try {
    const db = await mf.getD1Database('DB');
    const schema = fs.readFileSync('cloudflare/migrations/0001_vault.sql','utf8').replace(/--[^\n]*/g,'');
    await db.batch(schema.split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
    const origin=(await mf.ready).origin;
    for (const file of ['tests/web-browser.test.cjs', 'tests/device-profiles-browser.cjs']) {
      const child=spawn(process.execPath,[file],{stdio:'inherit',env:{...process.env,LINK_LAUNCHER_TEST_ORIGIN:origin}});
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      if(code) { process.exitCode=code; break; }
    }
  } finally { await mf.dispose(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
