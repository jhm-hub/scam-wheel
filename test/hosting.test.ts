import { describe, expect, it } from 'vitest';
import { hostedInstaller, hostedMonitorInstaller, publishedSiteUrl } from '../src/hosting.js';
import { decodeSharedConfig, encodeSharedConfig } from '../src/config/import.js';

describe('hosted installation', () => {
  it.each([
    ['https://faith.example/', 'https://faith.example/'],
    ['https://faith.example/wheels/scam', 'https://faith.example/wheels/scam/'],
    ['https://faith.example/wheels/scam/index.html?preview=1#settings', 'https://faith.example/wheels/scam/'],
    ['https://faith.example/wheels/scam/scam.html', 'https://faith.example/wheels/scam/'],
    ['https://faith.example/wheels/scam/wheel.html#old-config', 'https://faith.example/wheels/scam/'],
  ])('keeps the deployment path for %s', (address, expected) => {
    expect(publishedSiteUrl(address)).toBe(expected);
    expect(hostedInstaller('saved-code', address)).toContain('src="' + expected + 'wheel.js"');
    expect(hostedMonitorInstaller(address)).toContain('src="' + expected + 'monitor.js"');
    expect(hostedMonitorInstaller(address)).not.toContain('wheel.js');
  });

  it.each(['', 'file:///wheel.html', 'http://127.0.0.1:4329/', 'https://127.0.0.1/', 'https://localhost/', 'https://preview.local/', 'https://github.com/faith/wheel', 'https://user:secret@faith.example/', 'javascript:alert(1)'])('does not export an unusable address: %s', address => {
    expect(hostedInstaller('code', address)).toBeUndefined();
    expect(hostedMonitorInstaller(address)).toBeUndefined();
  });

  it('preserves saved game settings in a small external-script installer', async () => {
    const config = { gameMode: 'scam', colorPrimary: '#d994bb', scamConfig: JSON.stringify({ cash: [29], modes: [{ id: 0, name: 'Faith\'s money garden' }] }) };
    const html = hostedInstaller(await encodeSharedConfig(config), 'https://faith.example/wheel/')!;
    const code = JSON.parse(html.match(/window.WHEEL_CONFIG=(.*);<\/script>/)![1]!);
    expect(decodeSharedConfig(code)).toEqual(config);
    expect(html).toContain('background:transparent');
    expect(html).not.toContain('landaire');
    expect(html.length).toBeLessThan(2000);
  });

  it('does not let input close the config script', () => {
    const html = hostedInstaller('</script><script>bad()</script>', 'https://faith.example/')!;
    expect(html).not.toContain('<script>bad()');
    expect(html.match(/<script/g)).toHaveLength(2);
  });
});
