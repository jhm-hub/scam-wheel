// Installer URLs must remain usable outside the settings page's browser.
export function publishedSiteUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || host === 'github.com' || host === 'www.github.com' ||
        host.endsWith('.localhost') || host.endsWith('.local') ||
        /^(\d+\.){3}\d+$/.test(host)) return undefined;
    url.search = '';
    url.hash = '';
    if (/\.html?$/i.test(url.pathname)) url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    else if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  } catch {
    return undefined;
  }
}

export function hostedInstaller(configCode: string, siteUrl: string): string | undefined {
  const site = publishedSiteUrl(siteUrl);
  if (!site) return undefined;
  const source = new URL('wheel.js', site).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const code = JSON.stringify(configCode).replace(/</g, '\\u003c');
  return '<!doctype html>\n<html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>\n' +
    '<script>window.WHEEL_CONFIG=' + code + ';</script>\n' +
    '<script src="' + source + '"></script>\n</body></html>\n';
}

export function hostedMonitorInstaller(siteUrl: string): string | undefined {
  const site = publishedSiteUrl(siteUrl);
  if (!site) return undefined;
  const source = new URL('monitor.js', site).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return '<!doctype html>\n<html><head><meta charset="utf-8"></head><body>\n<script src="' + source + '"></script>\n</body></html>\n';
}
