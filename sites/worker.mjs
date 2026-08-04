const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function withProductionHeaders(response, pathname) {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }

  if (pathname.startsWith('/assets/') || pathname.startsWith('/draco/')) {
    headers.set(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800',
    );
  } else if (pathname === '/' || pathname === '/index.html') {
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (
      response.status === 404 &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      request.headers.get('Accept')?.includes('text/html')
    ) {
      const fallbackUrl = new URL('/index.html', request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }

    return withProductionHeaders(response, url.pathname);
  },
};
