import { wheelRotation, smooth, progress, sceneTiming, overlayOpacity } from "./motion.mjs";
import { EXTRA_MODES, isExtra, extraStatus } from "./extended.mjs";
import { THEME } from "./config.mjs";
import { pixelSprite } from "./pixel-art.mjs";
import { drawScene } from "./scenes.mjs";
import { board, STREETS, SWEETS } from "./model.mjs";
const TAU = Math.PI * 2, CX = 500, CY = 435, R = 310;
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (t) => 1 - Math.pow(1 - t, 3), mix = (a, b, t) => a + (b - a) * t;
function bezier(t, x1, y1, x2, y2) {
  const p = (s2, a, b) => 3 * (1 - s2) * (1 - s2) * s2 * a + 3 * (1 - s2) * s2 * s2 * b + s2 * s2 * s2;
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 14; i++) {
    s = (lo + hi) / 2;
    if (p(s, x1, x2) < t) lo = s;
    else hi = s;
  }
  return p(s, y1, y2);
}
const rotationAt = wheelRotation;
const sprites = {
  heart: ["..pp.pp..", ".ppppppp.", "ppppppppp", "ppppppppp", ".ppppppp.", "..ppppp..", "...ppp...", "....p...."],
  crown: ["g...g...g", "gg.ggg.gg", "ggggggggg", ".ggggggg.", ".ggpgpgg.", ".ggggggg.", ".fffffff."],
  star: ["....g....", "....g....", "...ggg...", ".ggggggg.", "ggggggggg", "..ggggg..", "..gg.gg..", ".gg...gg."],
  coin: ["..gggg..", ".gffffg.", "gffggffg", "gfgfgffg", "gffggffg", "gffgfgfg", ".gffffg.", "..gggg.."],
  bolt: ["....l..", "...ll..", "..lll..", ".llllll", "...lll.", "..lll..", "..ll...", "..l...."],
  sparkle: ["...f...", "...f...", "..fff..", "fffffff", "..fff..", "...f...", "...f..."]
};
function makeRenderer(canvas) {
  const dpi = Math.min(1.5, window.devicePixelRatio || 1);
  canvas.width = 1e3 * dpi;
  canvas.height = 920 * dpi;
  let ctx = canvas.getContext("2d"), cache = null, reduceMotion = false;
  const wheels = new Map(), itemKeys = new WeakMap();
  let pointerTicks = [];
  const P = { pink: "#e58abd", lilac: "#bca3e6", cream: "#fff2dc", ink: "#512545", gold: "#ffd98c", dark: "#422044" };
  function tint(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0")).join("");
  }
  function blendColor(from, to, amount) {
    const a = parseInt(from.slice(1), 16), b = parseInt(to.slice(1), 16);
    return "#" + [16, 8, 0].map(shift => Math.round(mix(a >> shift & 255, b >> shift & 255, amount)).toString(16).padStart(2, "0")).join("");
  }
  function circle(x, y, r, fill, stroke, w = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }
  function text(str, x, y, size = 22, fill = P.cream, weight = 1e3, outline = false) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = weight + " " + size + "px Nunito";
    if (outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, size * 0.11);
      ctx.strokeStyle = P.ink;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }
  function fit(str, maxSize, maxWidth) {
    let size = maxSize;
    ctx.font = "1000 " + size + "px Nunito";
    while (ctx.measureText(str).width > maxWidth && size > 18) {
      size--;
      ctx.font = "1000 " + size + "px Nunito";
    }
    return size;
  }
  function panel(x, y, w, h, fill = "#37203f", stroke = "#ffe4d2", cut = 12) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  function icon(name, x, y, size, angle = 0, alpha = 1) {
    const grid = sprites[name];
    if (!grid) return;
    const u = size / grid[0].length;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha *= alpha;
    const colors = { p: P.pink, g: P.gold, f: P.cream, l: P.lilac };
    ctx.fillStyle = "#512545";
    for (let y0 = 0; y0 < grid.length; y0++) for (let x0 = 0; x0 < grid[y0].length; x0++) if (grid[y0][x0] !== ".") ctx.fillRect((x0 - grid[0].length / 2) * u + u * 0.55, (y0 - grid.length / 2) * u + u * 0.65, u + 0.2, u + 0.2);
    for (let y0 = 0; y0 < grid.length; y0++) for (let x0 = 0; x0 < grid[y0].length; x0++) if (grid[y0][x0] !== ".") {
      ctx.fillStyle = colors[grid[y0][x0]];
      ctx.fillRect((x0 - grid[0].length / 2) * u, (y0 - grid.length / 2) * u, u + 0.2, u + 0.2);
    }
    ctx.restore();
  }
  function candy(x, y, r, color, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const col = SWEETS[color].color;
    circle(3, 5, r, "#38203f66");
    circle(0, 0, r, col, "#ffedf2", 2);
    circle(-r * 0.25, -r * 0.32, r * 0.28, "#ffffff66");
    const symbol = ["heart", "star", "sparkle"][color];
    icon(symbol, 2, 5, r * 0.85, 0, 0.9);
    ctx.restore();
  }
  function house(x, y, size, level, color = 0) {
    ctx.save();
    ctx.translate(x, y);
    const u = size / 16, high = Math.min(3, Math.max(1, level)), h = 9 + (high - 1) * 3;
    ctx.scale(u, u);
    ctx.globalAlpha *= level ? 1 : 0.5;
    ctx.fillStyle = "#573358";
    ctx.fillRect(-8, -h + 3, 17, h + 7);
    ctx.fillStyle = ["#ffe0ed", "#ddd1ff", "#ffe0c6", "#ffc8dd", "#c5efe1", "#ffe7ad"][color];
    ctx.fillRect(-7, -h + 3, 14, h + 6);
    ctx.fillStyle = level ? "#d65d9f" : "#9b7b9e";
    for (let row = 0; row < 5; row++) ctx.fillRect(-2 - row * 2, -h - 2 + row * 2, 4 + row * 4, 2);
    ctx.fillStyle = "#784a84";
    ctx.fillRect(-2, 3, 4, 6);
    ctx.fillStyle = level ? "#ffd98c" : "#a797b7";
    for (let floor = 0; floor < high; floor++) {
      ctx.fillRect(-5, -1 - floor * 4, 3, 3);
      ctx.fillRect(3, -1 - floor * 4, 3, 3);
    }
    ctx.fillStyle = "#fff7e1";
    ctx.fillRect(-7, 8, 14, 2);
    ctx.restore();
  }
  function dice(x, y, size, value, angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    panel(-size / 2 + 7, -size / 2 + 12, size, size, "#a45d94", "#6b3c75", size * 0.13);
    panel(-size / 2, -size / 2, size, size, "#fff0e2", "#fff9ed", size * 0.13);
    ctx.fillStyle = "#f4c3df";
    ctx.fillRect(-size / 2 + size * 0.12, size / 2 - size * 0.17, size * 0.76, size * 0.07);
    const pip = (a, b) => {
      ctx.fillStyle = "#a54a82";
      const d = size * 0.14;
      ctx.fillRect(a * size * 0.25 - d / 2, b * size * 0.25 - d / 2, d, d);
    };
    if (value % 2) pip(0, 0);
    if (value >= 2) {
      pip(-1, -1);
      pip(1, 1);
    }
    if (value >= 4) {
      pip(1, -1);
      pip(-1, 1);
    }
    if (value === 6) {
      pip(-1, 0);
      pip(1, 0);
    }
    ctx.restore();
  }
  function wheelCache(s, roulette) {
    const items = s.items;
    if (!itemKeys.has(items)) itemKeys.set(items, JSON.stringify(items));
    const key = s.scene + roulette + itemKeys.get(items) + JSON.stringify(s.theme);
    if (wheels.has(key)) return wheels.get(key);
    cache = document.createElement("canvas");
    cache.width = 1080;
    cache.height = 1080;
    const main = ctx;
    ctx = cache.getContext("2d");
    ctx.scale(1.5, 1.5);
    ctx.translate(360, 360);
    if (roulette) {
      let grad = ctx.createLinearGradient(-300, -300, 270, 300);
      grad.addColorStop(0, "#f9daef");
      grad.addColorStop(0.35, "#bb95d6");
      grad.addColorStop(0.68, "#e7bee0");
      grad.addColorStop(1, "#8b609c");
      circle(0, 0, R, grad, "#fce9e2", 4);
      circle(0, 0, R - 15, null, "#7c4d90", 4);
      circle(0, 0, R - 22, null, "#f4d5ec", 2);
      for (let i = 0; i < 6; i++) {
        const a = (i + 0.5) * TAU / 6 - Math.PI, x = Math.cos(a) * 202, y = Math.sin(a) * 202, item = items[i];
        const exit = item.kind === "exit";
        circle(x, y, 84, "#724272", "#f7d4ed", 3);
        circle(x, y, 75, exit ? "#eebf69" : "#4d2b5b", exit ? "#ffeac4" : "#b58bca", 4);
        const inset = ctx.createRadialGradient(x - 16, y - 20, 0, x, y, 76);
        inset.addColorStop(0, exit ? "#ffe8ab" : "#754b89");
        inset.addColorStop(1, exit ? "#c78452" : "#38213f");
        circle(x, y, 69, inset);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        if (exit) {
          icon("heart", 0, -15, 43);
          text("EXIT", 0, 30, 27, P.cream, 1e3, true);
        } else if (item.kind === "total") {
          text("\xD72", 0, -9, 46, P.gold, 1e3, true);
          text("TOTAL", 0, 32, 16, "#f9dff4");
        } else {
          text("$" + item.value, 0, 0, fit("$" + item.value, 46, 126), P.cream, 1e3, true);
        }
        ctx.restore();
      }
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 - Math.PI;
        circle(Math.cos(a) * 277, Math.sin(a) * 277, 6, "#ffe6f4", "#734b88", 2);
      }
    } else if (isExtra(s.scene)) {
      const def = EXTRA_MODES[s.scene], n = items.length;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n - Math.PI, b = a + TAU / n, m = (a + b) / 2, item = items[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R, a, b);
        ctx.closePath();
        ctx.fillStyle = def.colors[i % 2];
        ctx.fill();
        ctx.lineWidth = 2.3;
        ctx.strokeStyle = "#ffe9dc";
        ctx.stroke();
        ctx.save();
        ctx.translate(Math.cos(m) * 247, Math.sin(m) * 247);
        ctx.rotate(m + Math.PI / 2);
        pixelSprite(ctx, def.art, 0, -37, n > 8 ? 36 : 42, item.runner ?? item.charm ?? i % 3);
        text(item.label, 0, 1, fit(item.label, n > 8 ? 29 : 33, n > 8 ? 132 : 165), P.cream, 1e3, true);
        text(item.sub, 0, 34, n > 8 ? 13 : 15, P.cream, 1e3, true);
        ctx.restore();
      }
      circle(0, 0, R, null, "#67435e", 6);
    } else if (s.scene === "rent") {
      circle(0, 0, R, "#8ab3a8", "#e8e2bc", 4);
      circle(0, 0, 139, "#6c537b", "#e9c8df", 6);
      ctx.setLineDash([12, 13]);
      circle(0, 0, 116, null, "#e8cddd", 3);
      ctx.setLineDash([]);
      for (let i = 0; i < items.length; i++) {
        const a = i * TAU / 6 - Math.PI, b = a + TAU / 6, m = (a + b) / 2, item = items[i];
        ctx.beginPath();
        ctx.arc(0, 0, R - 7, a + 0.025, b - 0.025);
        ctx.arc(0, 0, 148, b - 0.025, a + 0.025, true);
        ctx.closePath();
        ctx.fillStyle = ["#bc719f", "#9e8ac2", "#c9938f", "#b36b91", "#78a99d", "#baa06f"][i];
        ctx.fill();
        ctx.strokeStyle = "#f8ddcb";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.save();
        ctx.translate(Math.cos(m) * 221, Math.sin(m) * 221);
        ctx.rotate(m + Math.PI / 2);
        text(item.name, 0, -48, 17, P.cream, 1e3, true);
        house(0, 16, 48, item.level, i);
        text(item.level ? "RENT $" + item.rent : "+$" + item.value + " RENT", 0, 61, fit(item.level ? "RENT $" + item.rent : "+$" + item.value + " RENT", 21, 153), P.cream, 1e3, true);
        ctx.restore();
      }
    } else if (s.scene === "gumball") {
      circle(0, 0, R, "#dec7e9", "#fff0dc", 4);
      for (let i = 0; i < items.length; i++) {
        const a = i * TAU / 9 - Math.PI, b = a + TAU / 9, m = (a + b) / 2, item = items[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R - 4, a, b);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? "#6b497e" : "#8c5e93";
        ctx.fill();
        ctx.strokeStyle = "#d4a9d3";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.translate(Math.cos(m) * 222, Math.sin(m) * 222);
        ctx.rotate(m + Math.PI / 2);
        candy(0, -14, 41, item.color);
        text("$" + item.value, 0, 52, fit("$" + item.value, 31, 115), P.cream, 1e3, true);
        ctx.restore();
      }
      circle(0, 0, R - 11, null, "#fff2f866", 7);
    } else {
      const n = items.length;
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n - Math.PI, b = (i + 1) * TAU / n - Math.PI, m = (a + b) / 2, item = items[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R, a, b);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? P.lilac : P.pink;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "#ffe9da";
        ctx.stroke();
        ctx.save();
        ctx.translate(Math.cos(m) * 234, Math.sin(m) * 234);
        ctx.rotate(m + Math.PI / 2);
        if (item.kind === "cash") text("$" + item.value, 0, 0, fit("$" + item.value, 47, 113), P.cream, 1e3, true);
        if (item.kind === "boost") {
          text("\xD72", 0, -10, 43, P.gold, 1e3, true);
          text("NEXT CASH", 0, 24, 14, P.cream, 1e3, true);
        }
        if (item.kind === "bonus") {
          text("$" + item.value, 0, -12, fit("$" + item.value, 43, 113), P.cream, 1e3, true);
          text("+1 SPIN", 0, 24, 17, P.cream, 1e3, true);
        }
        ctx.restore();
      }
      circle(0, 0, R, null, "#70345f", 7);
      circle(0, 0, R - 7, null, "#f5bcdf55", 3);
    }
    ctx = main;
    wheels.set(key, cache);
    if (wheels.size > 5) wheels.delete(wheels.keys().next().value);
    return cache;
  }
  function glowStroke(color, width = 3, blur = 18) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  function disc(s, t, roulette) {
    const image = wheelCache(s, roulette), angle = rotationAt(s, t);
    ctx.save();
    ctx.translate(CX, CY);
    ctx.shadowColor = "#130b2188";
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 12;
    circle(0, 0, 344, P.ink, P.cream, 5);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    circle(0, 0, 336, tint(P.lilac, 0.25), tint(P.lilac, 0.55), 3);
    circle(0, 0, 323, P.ink, P.pink, 3);
    ctx.save();
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(image, -360, -360, 720, 720);
    const selection = s.selection || (s.selected !== null ? {index:s.selected,at:t-250} : null);
    const highlight = selection ? overlayOpacity(selection,t,s.reduced) : 0;
    if (highlight > 0 && (!s.motion || selection.exitAt !== undefined)) {
      ctx.save();ctx.globalAlpha *= highlight;
      circle(0, 0, R, "#26132a66");
      const n = s.items.length, i = selection.index, a = i * TAU / n - Math.PI, b = a + TAU / n;
      ctx.save();
      ctx.beginPath();
      if (roulette) {
        const m = (a + b) / 2;
        ctx.arc(Math.cos(m) * 202, Math.sin(m) * 202, 79, 0, TAU);
      } else {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R - 6, a, b);
        ctx.closePath();
      }
      ctx.clip();
      ctx.drawImage(image, -360, -360, 720, 720);
      ctx.restore();
      ctx.beginPath();
      if (roulette) {
        const m = (a + b) / 2;
        ctx.arc(Math.cos(m) * 202, Math.sin(m) * 202, 80, 0, TAU);
      } else {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R - 5, a, b);
        ctx.closePath();
      }
      glowStroke("#ffedb9", 5, s.reduced ? 0 : 18);
      ctx.restore();
    }
    ctx.restore();
    const count = roulette ? 30 : 48;
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count, light = s.reduced ? 0.65 : 0.5 + 0.5 * Math.sin(a * 3 - t / 650);
      ctx.shadowBlur = 2 + light * 6;
      ctx.shadowColor = "#ffeab5";
      circle(Math.cos(a) * 329, Math.sin(a) * 329, roulette ? 3.5 : 3.1, tint(P.pink, 0.2 + light * 0.8));
    }
    ctx.shadowBlur = 0;
    if (s.scene === "gumball") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R - 16, Math.PI * 1.12, Math.PI * 1.69);
      ctx.strokeStyle = "#fff7ff44";
      ctx.lineWidth = 13;
      ctx.stroke();
      ctx.restore();
    }
    if (!isExtra(s.scene)) {
      const hub = ctx.createLinearGradient(-70, -70, 70, 70);
      hub.addColorStop(0, tint(P.pink, 0.6));
      hub.addColorStop(1, P.lilac);
      circle(0, 0, 88, P.pink, tint(P.pink, 0.65), 3);
      circle(0, 0, 79, hub, "#fff0dc", 5);
      circle(0, 0, 70, null, "#fff4ea66", 2);
      text("SCAM", 0, -14, 26, P.cream, 1e3, true);
      text("WHEEL", 0, 17, 25, P.cream, 1e3, true);
    }
    ctx.restore();
  }
  function pointer(s, t, roulette, transition = 1) {
    ctx.save();
    ctx.translate(CX, CY - 337);
    if (!s.tickAt) pointerTicks = [];
    if (s.tickAt && pointerTicks.at(-1) !== s.tickAt) pointerTicks.push(s.tickAt);
    pointerTicks = pointerTicks.filter(at => t-at >= 0 && t-at < 500).slice(-16);
    const kick = s.reduced ? 0 : pointerTicks.reduce((sum,at) => {const age=t-at;return sum + Math.sin(age/50)*Math.exp(-age/100);},0);
    ctx.rotate(Math.max(-0.25,Math.min(0.12,-kick*0.11)));
    ctx.shadowColor = "#e9b1da99";
    ctx.shadowBlur = 17;
    ctx.beginPath();
    ctx.moveTo(-22, -19);
    ctx.lineTo(22, -19);
    ctx.lineTo(30, 0);
    ctx.lineTo(0, 55);
    ctx.lineTo(-30, 0);
    ctx.closePath();
    ctx.fillStyle = "#fff0da";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#824571";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, -9);
    ctx.lineTo(14, -9);
    ctx.lineTo(20, 1);
    ctx.lineTo(0, 34);
    ctx.lineTo(-20, 1);
    ctx.closePath();
    const color = roulette ? P.pink : P.lilac, previous = s.previousScene;
    const previousColors = previous?.scene === "normal" ? previous.theme || THEME : THEME;
    ctx.fillStyle = previous && transition < 1 ? blendColor(previous.scene === "roulette" ? previousColors.pink : previousColors.lilac, color, transition) : color;
    ctx.fill();
    ctx.restore();
  }
  function decor(s, t, roulette) {
    const float = s.reduced ? 0 : Math.sin(t / 900) * 4;
    icon("crown", 201, 141 + float, 55, -0.22);
    icon("heart", 816, 197 - float, 47, 0.23);
    icon("star", 146, 540 - float, 35, -0.15);
    icon("coin", 813, 664 + float, 48, 0.16);
    icon("sparkle", 243, 752 + float, 27, 0, 0.85);
    icon("sparkle", 840, 413 - float, 25, 0, 0.65);
    icon("sparkle", 714, 105 - float, 27, 0, 0.85);
    icon("heart", 327, 805 - float, 24, -0.1, 0.65);
    if (isExtra(s.scene)) {
      pixelSprite(ctx, EXTRA_MODES[s.scene].art, 151, 309 + float, 55, 0, -0.15);
      pixelSprite(ctx, EXTRA_MODES[s.scene].art, 836, 534 - float, 47, 1, 0.15);
    } else if (s.scene === "gumball") {
      candy(156, 317 + float, 23, 0, -0.2);
      candy(831, 523 - float, 21, 2, 0.2);
    } else if (s.scene === "rent") {
      house(153, 310 + float, 35, 2, 0);
      house(832, 532 - float, 33, 1, 4);
    } else if (s.scene === "dice") {
      dice(146, 295 + float, 56, 3, -0.16);
      dice(834, 525 - float, 43, 5, 0.22);
    } else {
      icon("bolt", 157, 317 + float, 40, -0.1);
      icon("star", 830, 526 - float, 42, 0.18);
    }
  }
  function dimWheel(alpha = 0.52) {
    circle(CX, CY, 348, "rgba(30,14,40," + alpha + ")");
  }
  function particles(s, t) {
    const e = s.effect;
    if (!e || s.reduced) return;
    const age = (t - e.at) / 2200;
    if (age < 0 || age > 1) return;
    const count = e.kind === "final" ? 65 : e.kind === "exit" ? 38 : 24;
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996 + (e.seed || 0), v = 80 + i * 37 % 230, delay = i % 6 * 0.025, p = clamp((age - delay) / (1 - delay)), fade = 1 - p;
      const x = 500 + Math.cos(a) * v * p * (e.kind === "final" ? 2 : 1.3), y = (e.kind === "final" ? 380 : 360) + Math.sin(a) * v * p + 300 * p * p;
      ctx.save();
      ctx.globalAlpha = fade * smooth(p / 0.05);
      if (i % 5 === 0) icon(e.kind === "exit" ? "star" : "coin", x, y, 18 + i % 3 * 5, a + p * 3);
      else {
        ctx.translate(x, y);
        ctx.rotate(a + p * 8);
        ctx.fillStyle = [P.gold, P.pink, P.lilac, P.cream][i % 4];
        ctx.fillRect(-3, -5, 6, 10);
      }
      ctx.restore();
    }
  }
  function popPanel(title, main, sub, t, at, accent = P.gold) {
    const x = clamp((t - at) / 320), scale = reduceMotion ? 1 : 0.9 + 0.1 * ease(x);
    ctx.save();
    ctx.translate(500, 552);
    ctx.scale(scale, scale);
    ctx.shadowColor = "#1b0d2977";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    panel(-248, -88, 496, 181, "#3f254b", accent, 16);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    panel(-240, -80, 480, 165, "#3f254b", "#d394be77", 12);
    text(title, 0, -51, 15, "#e4bfdc", 900);
    const size = fit(main, 58, 450);
    text(main, 0, 1, size, accent, 1e3);
    text(sub, 0, 57, fit(sub, 18, 454), P.cream, 800);
    ctx.restore();
  }
  function hud(s, t) {
    const r = s.round;
    if (r.phase === "normal" || r.phase === "activate" || s.overlay?.kind === "intro") return;
    if (isExtra(r.mode)) {
      const [label, value] = extraStatus(r);
      panel(234, 797, 532, 78, "#3c254aee", EXTRA_MODES[r.mode].colors[2], 12);
      text(r.phase === "complete" ? s.overlay && s.overlay.kind !== "final" ? "FINAL REVEAL" : "ROUND COMPLETE" : r.spins === null ? "KEEP SPINNING" : r.spins + " SPIN" + (r.spins === 1 ? "" : "S") + " LEFT", 361, 821, 15, P.cream);
      text(EXTRA_MODES[r.mode].name, 361, 849, 17, P.gold);
      text(label, 637, 819, 13, P.cream);
      ctx.save();
      if (s.overlay?.kind === "arcade") { const reveal=sceneTiming(r.mode,s.overlay.entry).reveal;ctx.globalAlpha*=progress(t-s.overlay.at,reveal-160,reveal+80,s.reduced); }
      text(value, 637, 848, fit(value, 29, 230), P.gold);
      ctx.restore();
      return;
    }
    if (r.mode === "rent") {
      for (let i = 0; i < 6; i++) {
        const x = 252 + i * 99;
        panel(x - 46, 780, 92, 62, "#3c254aee", r.rents[i] ? "#f1cba2" : "#72547b", 8);
        text(STREETS[i], x, 798, 11, r.rents[i] ? P.cream : "#bba1c2");
        text("$" + r.rents[i], x, 826, fit("$" + r.rents[i], 24, 78), P.gold);
      }
      text(r.spins + " BUILDS LEFT  /  STREET RENT $" + r.rents.reduce((a, b) => a + b, 0), 500, 869, 18, P.cream, 900);
      return;
    }
    if (r.mode === "gumball") {
      const dropping = s.overlay?.kind === "candy", matching = s.overlay?.kind === "match", age = s.overlay ? t-s.overlay.at : 0;
      const preview = dropping || matching ? [...r.last.candies] : r.candies;
      if (dropping && age < 1200 && !s.reduced) preview[r.last.color]--;
      for (let i = 0; i < 3; i++) {
        const x = 310 + i * 190;
        panel(x - 88, 777, 176, 90, "#3c254aee", SWEETS[i].color, 9);
        text(SWEETS[i].name + " TRIO", x, 794, 12, SWEETS[i].color);
        for (let j = 0; j < 3; j++) {
          const bx = x - 38 + j * 38;
          if (j < preview[i]) {
            const fade=matching&&i===r.last.color?1-progress(age,1650,2100,s.reduced):1;
            if (matching && i===r.last.color) circle(bx,824,13,"#24172f","#86658e",2);
            ctx.save();ctx.globalAlpha*=fade;candy(bx,824,13,i);ctx.restore();
          }
          else circle(bx, 824, 13, "#24172f", "#86658e", 2);
        }
        text("SET +$" + r.prices.cash * SWEETS[i].factor, x, 851, 13, P.gold);
      }
      text(r.spins + " CANDIES LEFT  /  " + r.sets + " SETS CHARGED", 500, 893, 16, P.cream, 900);
      return;
    }
    const isDice = r.mode === "dice", pulse = s.hudAt && !s.reduced ? Math.sin(clamp((t - s.hudAt) / 700) * Math.PI) * 0.06 : 0;
    ctx.save();
    ctx.translate(500, 842);
    ctx.scale(1 + pulse, 1 + pulse);
    panel(-235, -36, 222, 73, "#3c254acc", "#b48ac8", 10);
    panel(13, -36, 222, 73, "#3c254acc", "#e8a6cb", 10);
    text(isDice ? "SPINS LEFT" : "EXIT CHAMBERS", -124, -14, 12, "#d7b9e6", 900);
    text(isDice ? String(r.spins) : "1 / 6", -124, 13, 30, P.cream);
    text(isDice ? "NEXT CASH" : "ENDING MULTIPLIER", 124, -14, 12, "#e8bfd7", 900);
    text("\xD7" + r.mult + (r.mult === 64 ? " MAX" : ""), 124, 13, 30, P.gold);
    ctx.restore();
  }
  function overlay(s, t) {
    const o = s.overlay;
    if (!o) return;
    if (o.kind === "intro") {
      dimWheel(0.64);
      const age = t - o.at, enter = progress(age, 0, 440, s.reduced);
      const titleIn = progress(age, 130, 390, s.reduced), nameIn = progress(age, 330, 620, s.reduced);
      const k = 0.92 + 0.08 * enter + (s.reduced ? 0 : Math.sin(enter * Math.PI) * 0.012);
      ctx.save();
      ctx.translate(500, 427 + (1 - enter) * 22);
      ctx.scale(k, k);
      icon("star", -251, -108, 53, -0.2);
      icon("heart", 252, 108, 41, 0.2);
      panel(-282, -91, 564, 182, "#a65c94", "#fff1d6", 16);
      panel(-271, -80, 542, 160, "#62345d", "#e5b8e9", 10);
      text("UH OH\u2026", 0, -48, 17, "#f6d3ea", 900);
      ctx.save();ctx.globalAlpha *= titleIn;
      text("SCAM ACTIVATED", 0, (1 - titleIn) * 12, 43, P.cream, 1e3, true);
      ctx.restore();
      ctx.save();ctx.globalAlpha *= nameIn;
      text(o.name, 0, 50 + (1 - nameIn) * 9, 23, P.gold);
      ctx.restore();
      if (!s.reduced) {
        const drift = progress(age, 220, 920), sparkle = progress(age, 220, 420) * (1 - progress(age, 620, 1080));
        for (let i = 0; i < 6; i++) {
          const side = i % 2 ? 1 : -1, y = (Math.floor(i / 2) - 1) * 80;
          icon("sparkle", side * (296 + drift * 25), y - drift * 16, 10 + i % 3 * 4, 0, sparkle * 0.8);
        }
      }
      ctx.restore();
    }
    if (o.kind === "die") {
      dimWheel(0.66);
      text("DICE BOOST", 500, 260, 34, P.cream, 1e3, true);
      const age = t - o.at, rolling = age < o.rollTime;
      const settle = 1 - progress(age,o.rollTime-450,o.rollTime,s.reduced);
      const value = !s.reduced && age < o.rollTime-220 ? 1 + Math.floor(12*(1-(1-clamp(age/o.rollTime))**2))%6 : o.value;
      const a = s.reduced ? 0 : Math.sin(age/100)*0.22*settle;
      dice(500, 421 - (s.reduced ? 0 : Math.abs(Math.sin(age/130))*12*settle), 160, value, a);
      text(rolling ? "ROLLING\u2026" : "+" + o.value + " EXTRA SPINS", 500, 566, rolling ? 23 : 33, P.gold, 1e3, true);
      if (!rolling) text(o.start + " starting + " + o.value + " bonus = " + (o.start + o.value) + " spins", 500, 612, 19, P.cream, 800);
    }
    if (o.kind === "arcade") {
      const e = o.entry, def = EXTRA_MODES[s.round.mode];
      const show = progress(t - o.at, sceneTiming(s.round.mode,e).reveal - 180, sceneTiming(s.round.mode,e).reveal + 120, s.reduced);
      ctx.save();
      ctx.globalAlpha *= show;
      ctx.translate(0, (1 - show) * 18);
      panel(212, 646, 576, 139, "#32203fee", def.colors[2], 13);
      text(e.headline, 500, 670, fit(e.headline, 26, 544), P.cream);
      text(e.amount ? "+$" + e.amount.toLocaleString("en-US") : "NO ADDED CHARGE", 500, 706, e.amount ? 42 : 24, P.gold);
      const detail = e.lines.length ? e.lines.map((v) => v.label + ": $" + v.value.toLocaleString("en-US")).join(" + ") : e.detail;
      const rows = [""];
      ctx.font = "800 15px Nunito";
      for (const word of detail.split(" ")) {
        const i = rows.length - 1;
        if (ctx.measureText(rows[i] + " " + word).width > 540) rows.push(word);
        else rows[i] += (rows[i] ? " " : "") + word;
      }
      rows.slice(0, 2).forEach((row, i) => text(row, 500, 740 + i * 21, 15, P.cream, 800));
      ctx.restore();
    }
    if (o.kind === "property") {
      const e = o.entry, age = clamp((t - o.at) / 900);
      if (!s.reduced) {
        for (let i = 0; i < 8; i++) icon("sparkle", 500 + (i - 3.5) * 23, 210 - 90 * age + i % 2 * 25, 18 * (1 - age), 0, 1 - age);
      }
      popPanel(e.level === 1 ? "PROPERTY BUILT" : "PROPERTY UPGRADED", e.name + " / LV " + e.level, "Rent $" + e.previousRent + " becomes $" + e.newRent + " per spin", t, o.at, "#c3edda");
    }
    if (o.kind === "rent") {
      const e = o.entry, entries = e.rents.map((v, i) => ({ value: v, name: STREETS[i] })).filter((v) => v.value), elapsed = t - o.at;
      const arrivals = entries.map((_, i) => progress(elapsed, 120 + i * 280, 360 + i * 280, s.reduced));
      const subtotal = Math.round(entries.reduce((sum, entry, i) => sum + entry.value * arrivals[i], 0));
      panel(300, 300, 400, 345, "#3c254bf2", "#ffe4c2", 15);
      text("RENT DAY", 500, 329, 27, P.gold);
      text("Every built property charges again", 500, 360, 16, P.cream, 800);
      for (let i = 0; i < entries.length; i++) {
        const y = 389 + i * 27 + (1 - arrivals[i]) * 5;
        ctx.save();
        ctx.globalAlpha *= 0.2 + arrivals[i] * 0.8;
        text(entries[i].name, 411, y, 15, P.cream);
        text("+$" + entries[i].value, 589, y, 18, P.gold);
        ctx.restore();
      }
      text("+$" + subtotal, 500, 597, 48, P.gold);
      text("ADDED TO YOUR BILL", 500, 630, 12, P.cream);
    }
    if (o.kind === "candy") {
      const e = o.entry, age = t - o.at, p = s.reduced ? 1 : ease(clamp(age / 1200)), targetX = 310 + e.color * 190 - 38 + (e.candies[e.color] - 1) * 38;
      const x = mix(500, targetX, p) + Math.sin(p * Math.PI) * 110, y = mix(230, 824, p) - Math.sin(p * Math.PI) * 70;
      if (!s.reduced && age < 1200) candy(x, y, 32 - 19 * p, e.color, p * TAU);
      const receipt = progress(age, 1040, 1280, s.reduced);
      ctx.save();ctx.globalAlpha *= receipt;
      ctx.translate(0, (1 - receipt) * 12);
      popPanel("CANDY DISPENSED", "+$" + e.base, SWEETS[e.color].name + " collection: " + e.candies[e.color] + " / 3", t, o.at + 1040, SWEETS[e.color].color);
      ctx.restore();
    }
    if (o.kind === "match") {
      dimWheel(0.55);
      const e = o.entry, age = (t - o.at) / 1e3;
      for (let i = 0; i < 3; i++) {
        const wobble = s.reduced ? 0 : Math.sin(age * 7 + i) * 8;
        candy(400 + i * 100, 345 + wobble, 38, e.color);
      }
      popPanel("THREE " + SWEETS[e.color].name + "!", "+$" + e.setBonus, "Set bonus + $" + e.base + " candy = $" + e.amount, t, o.at, SWEETS[e.color].color);
    }
    if (o.kind === "popup") popPanel(o.title, o.main, o.sub, t, o.at, o.accent || P.gold);
    if (o.kind === "exit") {
      dimWheel(0.65);
      const age = clamp((t - o.at) / 500);
      if (!s.reduced) {
        ctx.save();
        ctx.translate(500, 410);
        ctx.rotate(age * 0.3);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(TAU / 12);
          ctx.fillStyle = i % 2 ? "#e795c0" : "#ffd69a";
          ctx.fillRect(110, -5, 60, 10);
        }
        ctx.restore();
      }
      icon("star", 500, 366, 95, 0);
      text("BANG!", 500, 468, 80, P.cream, 1e3, true);
      text("EXIT FOUND", 500, 539, 25, P.gold, 1e3, true);
    }
    if (o.kind === "math") {
      dimWheel(0.62);
      popPanel("ENDING MULTIPLIER", "\xD7" + o.mult, "$" + o.before.toLocaleString("en-US") + " becomes $" + o.after.toLocaleString("en-US"), t, o.at);
    }
    if (o.kind === "final") {
      dimWheel(0.6);
      const k = s.reduced ? 1 : 0.94 + 0.06 * ease(clamp((t - o.at) / 550));
      ctx.save();
      ctx.translate(500, 439);
      ctx.scale(k, k);
      panel(-290, -171, 580, 342, "#8a4f82", "#ffe2be", 17);
      panel(-279, -160, 558, 320, "#37223f", "#e9b5d8", 12);
      for (let i = 0; i < 16; i++) {
        const lit = s.reduced ? 1 : 0.5 + 0.5 * Math.sin(t / 420 + i * 0.7);
        ctx.fillStyle = tint("#b979a8", lit * 0.65);
        ctx.fillRect(-261 + i * 34, -166, 19, 7);
        ctx.fillRect(-261 + i * 34, 159, 19, 7);
      }
      icon("crown", 0, -151, 68);
      text("YOU\u2019VE BEEN SCAMMED", 0, -97, 24, "#f6cee8");
      const amount = "$" + s.round.total.toLocaleString("en-US"), size = fit(amount, 97, 490);
      text(amount, 0, -14, size, P.gold);
      text({ dice: "Those extra spins added up.", roulette: "The exit comes with a bill.", rent: "Free to visit. Expensive to stay.", gumball: "A sweet tooth. A very sour bill." }[s.round.mode] || "Cute game. Quite a bill.", 0, 64, 21, P.cream, 800);
      text(o.detail, 0, 108, 16, "#d4b7e1", 800);
      ctx.restore();
    }
  }
  function sceneLayer(s, t, alpha = 1, scale = 1) {
    if (alpha <= 0) return;
    Object.assign(P, s.scene === "normal" ? s.theme || THEME : THEME);
    const roulette = s.scene === "roulette";
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(CX, CY);ctx.scale(scale, scale);ctx.translate(-CX, -CY);
    if (s.scene === "gumball") {
      panel(293, 646, 414, 114, "#cb75a4", "#ffe4d6", 18);
      panel(315, 669, 370, 70, "#996598", "#f0c2e1", 12);
      panel(437, 704, 126, 41, "#412342", "#edd2e7", 7);
      text("SWEET SHOP", 500, 687, 15, P.cream);
      panel(421, 57, 158, 39, "#b86f9f", "#ffecdb", 10);
      icon("heart", 500, 70, 29);
    }
    decor(s, t, roulette);
    disc(s, t, roulette);
    if (isExtra(s.scene)) drawScene(ctx, s, t);
    hud(s, t);
    ctx.restore();
  }
  function draw(s, t) {
    Object.assign(P, s.scene === "normal" ? s.theme || THEME : THEME);
    reduceMotion = s.reduced;
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    ctx.clearRect(0, 0, 1e3, 980);
    const roulette = s.scene === "roulette", trans = s.transformAt ? progress(t - s.transformAt, 0, 850, s.reduced) : 1;
    if (!s.reduced && trans < 1) {
      ctx.save();
      ctx.globalAlpha *= Math.sin(trans * Math.PI) * 0.7;
      ctx.translate(CX, CY);
      ctx.rotate(trans * TAU);
      ctx.strokeStyle = "#ffe3bd";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 22]);
      ctx.beginPath();
      ctx.arc(0, 0, 350 + Math.sin(trans * Math.PI) * 20, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (s.previousScene && trans < 1 && !s.reduced) {
      sceneLayer(s.previousScene, t, 1 - trans, 1 - trans * 0.025);
    }
    sceneLayer(s, t, trans, 0.96 + 0.04 * trans);
    Object.assign(P, s.scene === "normal" ? s.theme || THEME : THEME);
    pointer(s, t, roulette, trans);
    particles(s, t);
    ctx.save();
    ctx.globalAlpha *= overlayOpacity(s.overlay,t,s.reduced);
    overlay(s,t);
    ctx.restore();
    if (s.round.scripted) {
      panel(374, 18, 252, 38, "#3c254aee", P.gold, 8);
      text("SCRIPTED SHOWCASE", 500, 37, 16, P.gold);
    }
    if (s.waiting) {
      dimWheel(0.6);
      text("Waiting for the controls\u2026", 500, 435, 24);
    }
  }
  return { draw };
}
export {
  bezier,
  clamp,
  makeRenderer,
  rotationAt
};
