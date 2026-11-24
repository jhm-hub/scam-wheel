export const clamp01 = (n) => Math.max(0, Math.min(1, n));
export const mix = (a, b, p) => a + (b - a) * p;
export const smooth = (p) => { const x = clamp01(p); return x * x * x * (10 + x * (-15 + 6 * x)); };
export const progress = (age, start, end, reduced = false) => reduced ? 1 : smooth((age - start) / (end - start));
export const arc = (p, height) => Math.sin(Math.PI * clamp01(p)) * height;
export function spinProgress(p) {
  const x = clamp01(p);
  // Integral of 20*x*(1-x)^3: continuous launch and a long, quiet landing.
  return x * x * (10 + x * (-20 + x * (15 - 4 * x)));
}
export function wheelRotation(s, now) {
  if (!s.motion) return s.rotation;
  const m = s.motion, x = clamp01((now - m.at) / m.duration);
  if (s.reduced) return m.to;
  const pull = 0.085;
  if (x < pull) return mix(m.from, m.from - 7, smooth(x / pull));
  return mix(m.from - 7, m.to, spinProgress((x - pull) / (1 - pull)));
}
export function sceneTiming(mode, entry) {
  const reveal = {baggage:1200,auction:1500,race:1700,stamps:1300,bubble:1900,seats:1800,blocks:2000,charms:1250,toll:1750,credit:1250,map:1450,plinko:2100,encore:1450,bowling:2150,tower:1900,boss:1100}[mode] ?? 1600;
  return {reveal, duration:reveal + (entry?.lines?.length > 2 ? 1900 : 1550)};
}
export function overlayOpacity(o, now, reduced = false) {
  if (!o) return 0;
  if (reduced) return o.exitAt === undefined ? 1 : 0;
  const enter = reduced ? 1 : smooth((now - o.at) / 220);
  return enter * (o.exitAt === undefined ? 1 : 1 - smooth((now - o.exitAt) / 240));
}
export function motionClock() {
  // Shared epoch for companion tabs, monotonic inside each page.
  return performance.timeOrigin + performance.now();
}
