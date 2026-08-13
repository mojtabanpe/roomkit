export function tenantPortalUrl(email = ''): string {
  if (typeof window === 'undefined') return '/';

  const { hostname, protocol } = window.location;
  const query = email ? `?email=${encodeURIComponent(email)}` : '';

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5500/${query}`;
  }

  const root = hostname.replace(/^www\./, '').replace(/^app\./, '');
  return `${protocol}//tenant.${root}/${query}`;
}
