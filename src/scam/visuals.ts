const paths: Record<string, string> = {
    crown: '<path d="M15 31L34 48L50 16L66 48L85 31L76 79H24Z" fill="currentColor"/><path d="M28 89H72"/>',
    phone: '<path d="M23 11L38 28L28 43Q36 63 56 71L71 61L88 77Q81 99 60 87Q18 69 11 29Q9 18 23 11Z"/><path d="M55 12Q86 14 88 45M56 27Q73 28 74 45"/>',
    card: '<rect x="21" y="9" width="58" height="82" rx="8"/><path d="M40 36Q42 24 55 30Q67 38 51 49V56M51 70V71"/>',
    tree: '<path d="M50 80V43M50 61L32 49M50 53L69 36"/><path d="M25 49C3 23 39 4 50 20C68 0 98 29 76 45C78 63 57 69 50 57C36 71 18 65 25 49Z" fill="currentColor"/><path d="M27 85H73"/>',
    coin: '<circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="25"/><path d="M61 35H43C28 35 30 50 48 50C70 50 71 66 42 66M50 26V75"/>',
    magnet: '<path d="M18 20H37V56Q50 76 63 56V20H82V57C77 103 23 103 18 57Z"/><path d="M18 39H37M63 39H82M2 4L15 17M42 0L43 16M87 2L84 16"/>',
    lock: '<rect x="22" y="43" width="56" height="44" rx="12"/><path d="M34 43V29C34 6 66 6 66 29V43M50 60V71"/>',
    key: '<circle cx="29" cy="29" r="18"/><path d="M42 42L82 82M62 62L76 48M73 73L87 60"/>',
    shield: '<path d="M50 8L86 23L79 63Q70 81 50 93Q30 81 21 63L14 23Z"/><path d="M32 47L45 61L70 33"/>',
    hand: '<path d="M31 53V25Q31 12 41 20V44V13Q48 0 55 13V43V19Q62 8 69 19V46V32Q79 22 83 36V62Q78 91 52 89Q31 88 17 60Q13 46 26 48Z"/>',
    ticket: '<path d="M12 25H88V41Q72 50 88 59V76H12V59Q28 50 12 41Z"/><path d="M38 33V67M65 33V67"/>',
    star: '<path d="M50 6L62 35L93 39L70 60L77 92L50 76L23 92L30 60L7 39L38 35Z"/>',
    heart: '<path d="M50 85C-8 48 6 9 32 17Q43 18 50 32Q57 18 68 17C94 9 108 48 50 85Z"/>',
    wing: '<path d="M83 85Q19 84 12 11L75 53L27 24M75 63L23 38M75 74L31 56"/>',
    bolt: '<path d="M54 5L18 58H45L37 94L85 37H56Z"/>',
    ball: '<circle cx="50" cy="50" r="31" fill="currentColor"/><path d="M32 40Q35 28 49 28" stroke="#fff"/>',
    clock: '<circle cx="50" cy="54" r="34"/><path d="M50 32V54L66 66M38 8H62M50 8V19M76 21L85 13"/>',
};
export function icon(name: string): string { return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] ?? paths.star) + '</svg>'; }
const motifIcon: Record<string, string> = { orchard: 'tree', coins: 'coin', double: 'star', tags: 'ticket', spotlight: 'star', loops: 'ticket', hearts: 'heart', hotline: 'phone', tickets: 'ticket', expand: 'ticket', stars: 'star', magnet: 'magnet', triple: 'heart', angels: 'wing', split: 'heart', outage: 'bolt', hands: 'hand', rainbow: 'star', mirror: 'star', lasers: 'lock', parachute: 'ticket', speed: 'clock', bubbles: 'shield', mystery: 'card', locks: 'key', pinball: 'ball', combo: 'crown', encore: 'ticket' };
export function decorate(doc: Document, layer: HTMLElement, motif: string): void {
    layer.replaceChildren();
    layer.dataset.motif = motif;
    for (let i = 0; i < 6; i++) {
        const prop = doc.createElement('div');
        prop.className = 'scam-prop prop-' + i;
        prop.innerHTML = icon(motifIcon[motif] ?? 'star');
        layer.append(prop);
    }
    if (motif === 'lasers') {
        for (let i = 0; i < 4; i++) {
            const beam = doc.createElement('i');
            beam.className = 'scam-laser';
            beam.style.setProperty('--i', String(i));
            layer.append(beam);
        }
    }
    if (motif === 'bubbles') {
        for (let i = 0; i < 3; i++) {
            const ring = doc.createElement('i');
            ring.className = 'scam-shield-ring';
            ring.style.setProperty('--i', String(i));
            layer.append(ring);
        }
    }
    if (motif === 'rainbow') {
        const ring = doc.createElement('i');
        ring.className = 'scam-rainbow-ring';
        layer.append(ring);
    }
}
