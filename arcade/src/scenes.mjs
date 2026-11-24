import { EXTRA_MODES } from "./extended.mjs";
import { pixelSprite } from "./pixel-art.mjs";
const TAU = Math.PI * 2, clamp = (n) => Math.max(0, Math.min(1, n)), lerp = (a, b, t) => a + (b - a) * t, ease = (t) => 1 - (1 - t) ** 3;
const cream = "#fff0dd", gold = "#ffe0a0", pink = "#eea0bc", lilac = "#bc99dc", mint = "#a7dcc2";
function drawScene(ctx, s, t) {
  const mode = s.round.mode, def = EXTRA_MODES[mode], d = s.round.data;
  if (!def || !d) return;
  const e = s.overlay?.kind === "arcade" ? s.overlay.entry : null, age = e ? t - s.overlay.at : 3e3, p = s.reduced ? 1 : ease(clamp(age / 1850)), before = e?.fx.before ?? d;
  const text = (str, x, y, size = 20, color = cream) => {
    ctx.font = "1000 " + size + "px Nunito";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(String(str), x, y);
  };
  const rect = (x, y, w, h, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  };
  const circle = (x, y, r, fill, stroke) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  const line = (points, color = gold, width = 3) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  const sprite = (name, x, y, size = 64, variant = 0, angle = 0, alpha = 1) => pixelSprite(ctx, name, x, y, size, variant, angle, alpha);
  ctx.save();
  ctx.translate(500, 435);
  ctx.shadowColor = "#1b0d2988";
  ctx.shadowBlur = 12;
  circle(0, 0, 178, "#3a2548", def.colors[2]);
  ctx.shadowBlur = 0;
  circle(0, 0, 171, "#32223f", "#bd96b977");
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 168, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 16; i++) {
    const x = i * 71 % 310 - 155, y = i * 91 % 306 - 153;
    rect(x, y, 2, 2, "#dec3e415");
  }
  switch (mode) {
    case "baggage": {
      const weights = e && p < 0.45 ? before.weights : d.weights;
      for (let i = 0; i < weights.length; i++) {
        const x = -100 + i % 4 * 65, y = 66 - Math.floor(i / 4) * 61, bounce = e && i === weights.length - 1 ? Math.sin(p * Math.PI) * -35 : 0;
        sprite("parcel", x, y + bounce, 65, i);
        text(weights[i] + "kg", x, y + 27 + bounce, 15);
      }
      rect(-106, 109, 212, 19, "#8e647b");
      rect(-84, 128, 168, 8, "#e7bd97");
      text("HEAVIEST RATE", 0, -124, 16, def.colors[2]);
      text("$" + d.rate * s.round.prices.cash + " / KG", 0, -94, 28, gold);
      text(d.weight + " KG PACKED", 0, -52, 18);
      break;
    }
    case "auction": {
      const top = [...d.bids].sort((a, b) => b - a).slice(0, 2), count = d.bids.length;
      text("THE TOP TWO BOTH COUNT", 0, -127, 14, def.colors[2]);
      for (let i = 0; i < count; i++) {
        const x = -98 + i % 4 * 66, y = -56 + Math.floor(i / 4) * 54, isTop = top.includes(d.bids[i]);
        rect(x - 22, y - 18, 44, 39, isTop ? "#aa7095" : "#5a4169", isTop ? gold : "#a786ae");
        rect(x - 3, y + 21, 6, 18, "#b89183");
        text("$" + d.bids[i], x, y, Math.min(19, 75 / String(d.bids[i]).length), cream);
      }
      sprite("gavel", 53, 95, 76, 0, e && s.round.phase === "complete" ? Math.sin(p * Math.PI) * -0.7 : 0);
      text("SOLD x 2", -48, 117, 21, gold);
      break;
    }
    case "race": {
      text("FINISH AT " + d.finish, 0, -130, 22, def.colors[2]);
      for (let i = 0; i < 3; i++) {
        const y = -67 + i * 70;
        rect(-131, y + 15, 260, 15, ["#674557", "#554568", "#3e5c58"][i]);
        for (let k = 0; k < 7; k++) rect(-125 + k * 38, y + 21, 18, 2, "#e7cfe344");
        const pos = lerp(before.distance[i], d.distance[i], p) / d.finish;
        const x = -102 + Math.min(1, pos) * 204;
        sprite("horse", x, y - 3, 59, i, s.reduced ? 0 : Math.sin(t / 110 + i) * 0.025);
        text(d.distance[i], -140, y + 4, 22, [pink, lilac, mint][i]);
      }
      for (let y = -111; y < 117; y += 16) for (let j = 0; j < 2; j++) rect(122 + j * 8, y, 8, 8, (y / 16 + j) % 2 ? "#fce3cf" : "#88718d");
      break;
    }
    case "stamps": {
      for (let i = 0; i < 9; i++) {
        const x = -65 + i % 3 * 65, y = -65 + Math.floor(i / 3) * 65, stamped = d.marks[i] > 0;
        rect(x - 27, y - 27, 55, 55, stamped ? "#9571a1" : "#e9d4c2", stamped ? gold : "#c8a9ba");
        if (stamped) {
          sprite("stamp", x, y, 48, i);
          text("$" + d.marks[i], x, y + 15, Math.min(20, 70 / String(d.marks[i]).length), cream);
        } else text(i + 1, x, y, 25, "#775271");
      }
      const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];
      for (const i of d.lines) {
        const ends = [lines[i][0], lines[i][2]].map((v) => [-65 + v % 3 * 65, -65 + Math.floor(v / 3) * 65]);
        ctx.globalAlpha = 0.5;
        line(ends, gold, 5);
        ctx.globalAlpha = 1;
      }
      text(d.lines.length + " DUTY LINES", 0, 132, 18, gold);
      break;
    }
    case "bubble": {
      const pop = e && d.pops > before.pops, inflate = pop && age < 900 ? lerp(before.air / before.capacity, 1, clamp(age / 800)) : lerp(before.air / before.capacity, d.air / d.capacity, p), size = 90 + inflate * 137;
      if (pop && age > 750 && age < 1550 && !s.reduced) {
        const q = (age - 750) / 800;
        for (let i = 0; i < 16; i++) {
          const a = i * TAU / 16;
          circle(Math.cos(a) * (70 + q * 75), Math.sin(a) * (70 + q * 75), 9 * (1 - q), [pink, lilac, mint][i % 3]);
        }
      }
      sprite("bubble", 0, -14, size, d.pops % 3, 0, pop && age > 750 && age < 1100 ? 0.25 : 1);
      text(d.air + " / " + d.capacity + " AIR", 0, 111, 24, def.colors[2]);
      text(d.pops + " POP BONUSES", 0, 140, 16);
      break;
    }
    case "seats": {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * TAU / 6, x = Math.cos(a) * 107, y = Math.sin(a) * 107;
        sprite("chair", x, y, 63, i);
        text(i + 1, x, y + 29, 14, gold);
        if (d.occupied[i]) sprite("charm", x, y - 5, 25, i % 3);
      }
      if (e && !s.reduced && p < 1) for (const i of e.moved || []) {
        const a = -Math.PI / 2 + (i + p) * TAU / 6;
        sprite("charm", Math.cos(a) * 107, Math.sin(a) * 107 - 10, 34, i % 3);
      }
      text("GUESTS MOVED", 0, -15, 13);
      text(d.moves, 0, 20, 38, gold);
      if (d.standing) text("STANDING: " + d.standing, 0, 53, 14, pink);
      break;
    }
    case "blocks": {
      for (let col = 0; col < 4; col++) for (let row = 0; row < 8; row++) rect(-62 + col * 33, 102 - row * 28, 30, 25, "#4c385d", "#715275");
      const clearing = e?.cleared && age < 1300, heights = clearing ? before.heights.map((h, i) => h + (i === e.fx.item.column ? e.fx.item.value : 0)) : d.heights;
      for (let col = 0; col < 4; col++) for (let row = 0; row < Math.min(8, heights[col]); row++) {
        const y = 102 - row * 28;
        rect(-62 + col * 33, y, 30, 25, [pink, lilac, mint, gold][col]);
        rect(-59 + col * 33, y + 3, 23, 3, "#fff3db99");
        rect(-36 + col * 33, y + 6, 3, 17, "#49294266");
      }
      if (clearing) {
        ctx.globalAlpha = s.reduced ? 0.4 : Math.sin(age / 80) * 0.3 + 0.5;
        rect(-64, 105 - e.cleared * 28, 134, e.cleared * 28, "#fff7d9");
        ctx.globalAlpha = 1;
      }
      text(d.lines + " ROWS CLEARED", 0, 145, 16, gold);
      break;
    }
    case "charms": {
      line([[-122, -65], [-70, -9], [0, 16], [70, -9], [122, -65]], gold, 5);
      for (let i = 0; i < 3; i++) {
        const x = -92 + i * 92, y = i === 1 ? 8 : -11;
        const count = d.counts[i];
        sprite("charm", x, y, 70, i, 0, count ? 1 : 0.35);
        text(count + (count === 1 ? " COPY" : " COPIES"), x, y + 59, 20);
        text("$" + count * s.round.prices.cash * (i + 1) + " EACH", x, y + 83, 18, gold);
      }
      text("EVERY COPY GETS REPRICED", 0, -119, 14, def.colors[2]);
      break;
    }
    case "toll": {
      circle(0, 0, 124, "#4f415a");
      circle(0, 0, 83, "#668777");
      ctx.strokeStyle = "#e7d7b6";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, 105, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 12; i++) {
        const a2 = -Math.PI / 2 + i * TAU / 12, x = Math.cos(a2) * (i % 3 === 0 ? 146 : 118), y = Math.sin(a2) * (i % 3 === 0 ? 146 : 118);
        if (i % 3 === 0) {
          rect(x - 19, y - 14, 38, 29, "#b6819d", gold);
          text("$" + (i === 0 ? 4 : i / 3) * s.round.prices.cash, x, y, 15, cream);
        } else circle(x, y, 3, "#f8dbb6");
      }
      const progress = lerp(before.travel, d.travel, p), a = -Math.PI / 2 + progress * TAU / 12;
      sprite("car", Math.cos(a) * 105, Math.sin(a) * 105, 47, 0, a + Math.PI / 2);
      text(d.gates, 0, -11, 42, gold);
      text("TOLLS", 0, 29, 16);
      break;
    }
    case "credit": {
      sprite("card", 0, -26, 219);
      const ratio = Math.min(1, d.spent / d.limit);
      rect(-112, 67, 224, 20, "#22132f", "#c7a7ce");
      rect(-109, 70, 218 * ratio, 14, ratio === 1 ? pink : mint);
      text("$" + d.spent + " / $" + d.limit, 0, 112, 20, def.colors[2]);
      text(d.over ? "OVER LIMIT +$" + d.over : "AVAILABLE CREDIT", 0, -126, 17, d.over ? pink : cream);
      if (d.over) line([[-82, -52], [-35, -20], [-14, -44], [12, -4], [38, -19], [79, 23]], "#fff1e3", 4);
      break;
    }
    case "map": {
      const values = [1, 2, 1, 3, 1, 2, 2, 3, 4];
      for (let i = 0; i < 9; i++) {
        const x2 = -64 + i % 3 * 64, y2 = -64 + Math.floor(i / 3) * 64;
        rect(x2 - 28, y2 - 28, 56, 56, i % 2 ? "#9e9c7d" : "#7d9b87", "#d9d7b0");
        text("$" + values[i] * s.round.prices.cash, x2, y2 + 13, 20, "#fff4df");
        rect(x2 - 20, y2 - 18, 8, 7, "#bed5ae");
        rect(x2 - 10, y2 - 22, 9, 9, "#b7d6b0");
      }
      let x = lerp(before.x, d.x, p), y = lerp(before.y, d.y, p);
      if (e?.wrap) {
        x = p < 0.5 ? before.x : d.x;
        y = p < 0.5 ? before.y : d.y;
        ctx.globalAlpha = Math.abs(p * 2 - 1);
      }
      sprite("compass", -64 + x * 64, -77 + y * 64, 48);
      ctx.globalAlpha = 1;
      text(d.detours + (d.detours === 1 ? " DETOUR" : " DETOURS"), 0, 130, 20, gold);
      break;
    }
    case "plinko": {
      for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) circle(-96 + col * 48, -115 + row * 31, 3, "#e7c9de");
      const factors = [1, 3, 8, 3, 1];
      for (let col = 0; col < 5; col++) {
        rect(-118 + col * 48, 88, 44, 26, col === 2 ? "#a27b48" : "#75577f", col === 2 ? gold : "#d7b3d6");
        text("$" + s.round.prices.cash * factors[col], -96 + col * 48, 101, Math.min(18, 70 / String(s.round.prices.cash * factors[col]).length), cream);
      }
      const path = d.path.length ? d.path : [2, 2, 2, 2, 2, 2, 2], q = p * 6, segment = Math.min(5, Math.floor(q)), fract = q - segment, x = -96 + lerp(path[segment], path[segment + 1], fract) * 48, y = -118 + q * 30.5;
      sprite("marble", x, y, 35, 0);
      break;
    }
    case "encore": {
      for (let i = 0; i < 3; i++) {
        const x = -93 + i * 93, lit = i < d.note || e && d.songs > before.songs && age < 1600;
        rect(x - 35, -61, 70, 88, lit ? "#ae7fa9" : "#654676", lit ? gold : "#a78abc");
        text(["C", "E", "G"][i], x, -16, 42, lit ? gold : cream);
      }
      for (let i = 0; i < 7; i++) {
        rect(-105 + i * 30, 65, 28, 52, "#ead8e4", "#5e416a");
        if (i < 6) rect(-85 + i * 30, 65, 11, 31, "#563d67");
      }
      if (e && !s.reduced) sprite("note", -93 + e.fx.item.note * 93, -105 + p * 36, 55, e.hit ? 0 : 1, p * 0.3);
      text(d.songs + (d.songs === 1 ? " ENCORE" : " ENCORES"), 0, 152, 16, gold);
      break;
    }
    case "bowling": {
      ctx.fillStyle = "#b78e81";
      ctx.beginPath();
      ctx.moveTo(-81, -113);
      ctx.lineTo(81, -113);
      ctx.lineTo(155, 167);
      ctx.lineTo(-155, 167);
      ctx.closePath();
      ctx.fill();
      for (let i = -2; i <= 2; i++) line([[i * 30, -113], [i * 47, 168]], "#e7c5a555", 2);
      const positions = [[0, -31], [-24, -58], [24, -58], [-48, -85], [0, -85], [48, -85], [-72, -112], [-24, -112], [24, -112], [72, -112]];
      for (let i = 9; i >= 0; i--) {
        const existed = before.pins[i], fallen = e?.fallen?.includes(i), active = e ? existed : d.pins[i], after = p > 0.8;
        if (!active || fallen && after && p >= 1) continue;
        const [x, y] = positions[i];
        sprite("pin", x + (fallen && p > 0.6 ? (p - 0.6) * 60 * (i % 2 ? 1 : -1) : 0), y + (fallen && p > 0.6 ? (p - 0.6) * 40 : 0), 42, 0, fallen && p > 0.6 ? (p - 0.6) * 3 : 0, fallen && p > 0.6 ? 1 - (p - 0.6) * 2.5 : 1);
      }
      sprite("marble", e ? Math.sin(p * Math.PI) * (e.fx.item.aim === 0 ? -70 : e.fx.item.aim === 1 ? 70 : 0) : 0, e ? lerp(147, -28, p) : 138, 52, 1);
      text("RACKS CLEARED: " + d.racks, 0, 152, 15, gold);
      break;
    }
    case "tower": {
      const floors = d.floors.slice(-9), base = 112, start = Math.max(0, d.floors.length - 9);
      rect(-128, base + 18, 256, 12, "#ad8d90");
      floors.forEach((floor, i) => {
        const y = base - i * 27, isLast = i === floors.length - 1, x = -80 + floor.x * 20 + (isLast && e ? (1 - p) * 180 * (floor.dir || 1) : 0);
        for (let k = 0; k < floor.width; k++) {
          rect(x + k * 20, y, 19, 24, [pink, lilac, mint][(i + start) % 3]);
          rect(x + k * 20 + 2, y + 2, 15, 3, "#fff0da99");
        }
        if (isLast && floor.cut && e && p < 1) {
          const cutX = floor.dir < 0 ? x - floor.cut * 20 : x + floor.width * 20;
          for (let k = 0; k < floor.cut; k++) rect(cutX + k * 20, y + p * p * 190, 18, 23, "#a4829d");
        }
      });
      text(d.width + " WIDE / " + d.waste + " OFFCUTS", 0, -145, 16, gold);
      break;
    }
    case "boss": {
      const hit = e && !e.fx.item.heal, shake = hit && !s.reduced ? Math.sin(age / 38) * Math.max(0, 1 - age / 650) * 12 : 0, dead = d.hp === 0;
      const hp = lerp(before.hp, d.hp, p);
      rect(-116, -133, 232, 22, "#25152f", "#c9a0bd");
      rect(-113, -130, 226 * hp / d.max, 16, dead ? gold : pink);
      sprite("pig", shake, 9, 185, 0, dead ? p * 0.3 : 0, dead ? 1 - p * 0.45 : 1);
      text(Math.ceil(hp) + " / " + d.max + " HP", 0, -95, 20, cream);
      if (e?.fx.item.heal) {
        sprite("charm", -89, -5 - (s.reduced ? 0 : p * 50), 43, 0, 0, 1 - p * 0.6);
        text(e.healed ? "+" + e.healed + " HP" : "FULL HEALTH", 0, 124, 26, mint);
      } else text(dead ? "BOUNTY BILLED" : "BOSS BILL", 0, 128, 23, gold);
      break;
    }
  }
  ctx.restore();
  ctx.restore();
}
export {
  drawScene
};
