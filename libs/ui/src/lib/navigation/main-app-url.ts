export interface BrowserLocation {
  readonly hostname: string;
  readonly protocol: string;
}

const PANEL_SUBDOMAINS = /^(?:admin|app|dashboard|tenant|www)\./;

export function mainAppUrl(location?: BrowserLocation): string {
  const current =
    location ?? (typeof window === 'undefined' ? undefined : window.location);

  if (!current) return '/';

  const { hostname, protocol } = current;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  ) {
    return `${protocol}//${hostname}:5200/`;
  }

  let root = hostname;
  while (PANEL_SUBDOMAINS.test(root)) root = root.replace(PANEL_SUBDOMAINS, '');
  return `${protocol}//${root}/`;
}
