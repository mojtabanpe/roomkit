import { mainAppUrl } from './main-app-url';

describe('mainAppUrl', () => {
  it('returns the web development server for local panel apps', () => {
    expect(mainAppUrl({ hostname: 'localhost', protocol: 'http:' })).toBe(
      'http://localhost:5200/',
    );
  });

  it.each(['tenant', 'dashboard', 'admin', 'www'])(
    'returns the main domain from the %s subdomain',
    (subdomain) => {
      expect(
        mainAppUrl({
          hostname: `${subdomain}.roomkit.ir`,
          protocol: 'https:',
        }),
      ).toBe('https://roomkit.ir/');
    },
  );
});
