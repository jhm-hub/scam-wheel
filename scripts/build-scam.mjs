import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

export async function buildScamPages() {
  // Use the browser's URL validation and installer format for the downloadable build too.
  const helper = await esbuild.build({ entryPoints: ['src/hosting.ts'], bundle: true, format: 'esm', write: false });
  const { publishedSiteUrl, hostedInstaller, hostedMonitorInstaller } = await import('data:text/javascript;base64,' + Buffer.from(helper.outputFiles[0].text).toString('base64'));
  const requestedUrl = process.env.FAITH_SITE_URL?.trim();
  const siteUrl = requestedUrl ? publishedSiteUrl(requestedUrl) : undefined;
  if (requestedUrl && !siteUrl) throw new Error('FAITH_SITE_URL must be the published HTTPS site address, not the GitHub repository address.');

  await esbuild.build({ entryPoints: ['src/scam/desk.ts'], bundle: true, format: 'iife', outfile: 'dist/desk.js', target: 'es2022' });
  await esbuild.build({ entryPoints: ['src/scam/monitor-entry.ts'], bundle: true, format: 'iife', outfile: 'dist/monitor.js', target: 'es2022', loader: { '.css': 'text' } });
  const monitor = readFileSync('dist/monitor.js', 'utf8');
  const monitorHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faith - Private Live Totals</title></head><body><script>' + monitor.replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
  writeFileSync('dist/monitor.html', monitorHtml);
  writeFileSync('dist/StreamElements-Private-Totals.txt', monitorHtml);
  const assets = {
    wheel: readFileSync('dist/wheel.js', 'utf8'),
    desk: readFileSync('dist/desk.js', 'utf8'),
    css: readFileSync('src/styles/desk.css', 'utf8'),
  };
  const encoded = JSON.stringify(assets).replace(/</g, '\\u003c');
  const html = (stream) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faith Scam Wheel - Arcade</title></head><body><script>window.FAITH_STREAM=' + stream + ';window.FAITH_HOSTED_URL=' + JSON.stringify(siteUrl ?? null).replace(/</g, '\\u003c') + ';window.FAITH_ASSETS=' + encoded + ';const s=document.createElement("style");s.textContent=FAITH_ASSETS.css;document.head.append(s);for(const source of [FAITH_ASSETS.wheel,FAITH_ASSETS.desk]){const script=document.createElement("script");script.textContent=source;document.body.append(script)}</script></body></html>';
  writeFileSync('dist/index.html', html(false));
  writeFileSync('dist/scam.html', html(false));
  writeFileSync('dist/scam-stream.html', html(true));
  const defaults = { gameMode: 'scam', spinCommand: '!scam', wheelCommand: '!scam', colorScheme: 'auto', colorPrimary: '#d994bb', colorSecondary: '#c1a9e6', fontFamily: '', enableCommands: true, hubMode: 'text', hubText: 'SCAM\nWHEEL', hubSize: 30, volumeWin: 55 };
  const code = Buffer.from(JSON.stringify(defaults)).toString('base64url');
  await esbuild.build({ entryPoints: ['src/browser/controls.ts'], bundle: true, format: 'iife', outfile: 'dist/browser-controls.js', target: 'es2022' });
  await esbuild.build({ entryPoints: ['src/browser/viewer.ts'], bundle: true, format: 'iife', outfile: 'dist/browser-viewer.js', target: 'es2022' });
  const browserCss = readFileSync('src/browser/controls.css', 'utf8');
  const browserFont = readFileSync('assets/Bungee-Regular.ttf').toString('base64');
  writeFileSync('dist/browser.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Scam Wheel - Private Browser Controls</title><style>@font-face{font-family:"Scam Arcade";src:url(data:font/ttf;base64,' + browserFont + ')}' + browserCss + '</style></head><body><script src="./browser-controls.js"></script></body></html>');
  writeFileSync('dist/browser-wheel.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Scam Wheel - Live Browser Wheel</title><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body><script src="./wheel.js"></script><script src="./browser-viewer.js"></script></body></html>');
  writeFileSync('dist/StreamElements-HTML.txt', '<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body><script>window.WHEEL_CONFIG=' + JSON.stringify(code) + ';</script><script>' + assets.wheel.replace(/<\/script/gi, '<\\/script') + '</script></body></html>');
  if (siteUrl) {
    writeFileSync('dist/StreamElements-Hosted-HTML.txt', hostedInstaller(code, siteUrl));
    writeFileSync('dist/StreamElements-Private-Totals-Hosted.txt', hostedMonitorInstaller(siteUrl));
  } else {
    rmSync('dist/StreamElements-Hosted-HTML.txt', { force: true });
    rmSync('dist/StreamElements-Private-Totals-Hosted.txt', { force: true });
  }
  writeFileSync('dist/StreamElements-Hosted-Setup.txt', 'Open the published Faith Scam Wheel homepage and choose Stream setup.\nSave your settings, then copy the viewer and private totals installers.\nThe installer uses the published website address automatically.\nThe GitHub Pages workflow supplies that address during deployment.\nFor a local build with a known site address, set FAITH_SITE_URL before building.\nInstall the viewer in the OBS scene. Install the private panel in a second StreamElements overlay on the same account; open it only as a private browser/dock.\nUse !scam spin, !scam new PlayerName and !scam finish.\nStreamElements-HTML.txt and StreamElements-Private-Totals.txt are embedded copies without hosted updates.\n');
}
