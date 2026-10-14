export function arcadeAudio(disabled: boolean, volume: number, factory?: () => AudioContext) {
    let ctx: AudioContext | undefined;
    let muted = disabled;
    const voices = new Set<OscillatorNode>();
    function notes(values: number[], step = .085, type: OscillatorType = 'triangle', gain = .12) {
        if (muted || volume === 0)
            return;
        try {
            ctx ??= factory ? factory() : new AudioContext();
            void ctx.resume();
            const now = ctx.currentTime;
            values.forEach((freq, i) => { const o = ctx!.createOscillator(), g = ctx!.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(.0001, now + i * step); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain * volume), now + i * step + .01); g.gain.exponentialRampToValueAtTime(.0001, now + (i + 1) * step + .12); o.connect(g); g.connect(ctx!.destination); o.start(now + i * step); o.stop(now + (i + 1) * step + .13); voices.add(o); o.onended = () => { voices.delete(o); o.disconnect(); g.disconnect(); }; });
        }
        catch { /* Audio is optional in headless and blocked browser contexts. */ }
    }
    return { activate: () => notes([523, 659, 784, 1047, 784, 1047, 1318], .09, 'square', .035), combo: (level: number) => notes([523, 659, 784, 1047].slice(0, level + 1), .09, 'square', .04), bumper: (index: number) => notes([660 + index * 220, 990 + index * 220], .05, 'triangle', .1), tick: () => notes([460], .018, 'triangle', .045), win: () => notes([523, 659, 784, 1047]), reveal: (id: number) => notes([262 + (id % 5) * 30, 392, 330, 523, 784], .12, 'square', .055), zap: () => notes([180, 110, 70], .065, 'sawtooth', .07), key: () => notes([880, 1175, 1568], .1), finish: () => notes([523, 659, 784, 1047, 784, 1047, 1318], .11), setMuted: (value: boolean) => { muted = value; if (muted)
            voices.forEach(v => { try {
                v.stop();
            }
            catch { } }); }, stop: () => { voices.forEach(v => { try {
            v.stop();
        }
        catch { } }); voices.clear(); }, dispose: () => { voices.forEach(v => { try {
            v.stop();
        }
        catch { } }); voices.clear(); void ctx?.close(); } };
}
