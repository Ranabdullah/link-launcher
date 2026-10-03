// Commercial API entry point. The buyer's own deployment remains modifiable.
import vaultWorker from './vault-worker.mjs';
const deny = () => new Response(JSON.stringify({error:'A valid purchased licence is required for this account.'}), {status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request, env) {
    const route = new URL(request.url).pathname;
    if (!route.startsWith('/api/') || route === '/api/health') return vaultWorker.fetch(request, env);
    try {
      const raw = request.headers.get('X-Link-Launcher-License');
      if (!raw || raw.length > 8192 || !env.LICENSE_PUBLIC_KEY) return deny();
      const bundle = JSON.parse(raw);
      if (typeof bundle.payload !== 'string' || bundle.payload.length > 4096 || typeof bundle.signature !== 'string' || bundle.signature.length > 256) return deny();
      const key = await crypto.subtle.importKey('jwk', JSON.parse(env.LICENSE_PUBLIC_KEY), {name:'ECDSA',namedCurve:'P-256'}, false, ['verify']);
      const signature = Uint8Array.from(atob(bundle.signature.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      if (!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,new TextEncoder().encode(bundle.payload))) return deny();
      const licence = JSON.parse(bundle.payload);
      if (licence.version !== 1 || licence.product !== 'link-launcher-commercial-v1' || !licence.email || !licence.installation || !licence.order) return deny();
      // Overwrite any client-supplied claimed identity with the verified buyer.
      const headers = new Headers(request.headers);
      headers.set('X-Link-Launcher-Verified-Email', licence.email);
      return vaultWorker.fetch(new Request(request, {headers}), env);
    } catch { return deny(); }
  }
};
