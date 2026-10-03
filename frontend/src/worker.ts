const ORIGIN = 'https://r1.verita.tech';

interface WorkerEnvironment {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

const siteHeaders = {
  'content-security-policy':
    "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; frame-src https://wallet.payrail.one; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  'permissions-policy':
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export default {
  async fetch(
    request: Request,
    environment: WorkerEnvironment,
  ): Promise<Response> {
    const incoming = new URL(request.url);
    const target = backendTarget(incoming);
    if (!target) {
      return withHeaders(await environment.ASSETS.fetch(request), siteHeaders);
    }
    if (!target.methods.includes(request.method)) {
      return withHeaders(new Response('method not allowed', { status: 405 }), {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
    }
    const headers = new Headers(request.headers);
    headers.delete('authorization');
    headers.delete('cookie');
    headers.set('host', target.url.host);
    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (request.method === 'POST') init.body = request.body;
    return withHeaders(await fetch(new Request(target.url, init)), {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
  },
};

function backendTarget(
  incoming: URL,
): { readonly url: URL; readonly methods: readonly string[] } | null {
  const upstream = new URL(ORIGIN);
  upstream.search = incoming.search;
  if (
    incoming.pathname === '/store/catalog' ||
    /^\/store\/orders\/[0-9a-f]{64}$/.test(incoming.pathname)
  ) {
    upstream.pathname = `/payrail${incoming.pathname}`;
    return { url: upstream, methods: ['GET', 'HEAD'] };
  }
  if (incoming.pathname === '/store/orders') {
    upstream.pathname = '/payrail/store/orders';
    return { url: upstream, methods: ['POST'] };
  }
  if (/^\/api\/checkouts\/[0-9a-f]{64}$/.test(incoming.pathname)) {
    upstream.pathname = `/payrail${incoming.pathname}`;
    return { url: upstream, methods: ['GET', 'HEAD'] };
  }
  return null;
}

function withHeaders(
  response: Response,
  additions: Readonly<Record<string, string>>,
): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(additions)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
