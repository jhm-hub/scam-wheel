const cache = /* @__PURE__ */ new Map();
function make(name, variant) {
  const image = document.createElement("canvas");
  image.width = image.height = 72;
  const g = image.getContext("2d");
  const ink = "#342233", shine = "#fff0d0", gold = "#edc88f", shade = "#8a6557", pink = "#eea0bc", rose = "#c7769d", lilac = "#bc99dc", purple = "#654b88", mint = "#a7dcc2", green = "#4f8d87";
  const r = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const p = (points, c) => {
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.fillStyle = c;
    g.fill();
  };
  const ellipse = (x, y, rx, ry, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  const oct = (x, y, w, h, c) => p([[x + 6, y], [x + w - 6, y], [x + w, y + 6], [x + w, y + h - 6], [x + w - 6, y + h], [x + 6, y + h], [x, y + h - 6], [x, y + 6]], c);
  const cube = (x, y, w, h, col, hi, lo) => {
    p([[x, y + 6], [x + 12, y], [x + w, y], [x + w, y + h], [x + w - 12, y + h + 6], [x, y + h + 6]], ink);
    r(x + 2, y + 8, w - 16, h - 4, col);
    p([[x + 2, y + 6], [x + 12, y + 2], [x + w - 4, y + 2], [x + w - 14, y + 6]], hi);
    p([[x + w - 12, y + 8], [x + w - 2, y + 4], [x + w - 2, y + h - 2], [x + w - 12, y + h + 2]], lo);
    r(x + 4, y + 10, 2, h - 8, hi);
    r(x + 4, y + h, w - 20, 2, hi);
  };
  const coin = (x, y) => {
    oct(x, y, 22, 24, shade);
    oct(x + 2, y + 2, 18, 20, gold);
    r(x + 5, y + 4, 9, 2, shine);
    r(x + 4, y + 6, 2, 7, shine);
    r(x + 10, y + 6, 3, 12, shade);
    r(x + 7, y + 9, 9, 2, shade);
    r(x + 8, y + 15, 8, 2, shade);
  };
  const heart = (x, y, col, sz = 1) => {
    g.save();
    g.translate(x, y);
    g.scale(sz, sz);
    p([[0, 6], [4, 2], [10, 2], [14, 6], [18, 2], [24, 2], [28, 6], [28, 16], [14, 30], [0, 16]], ink);
    p([[2, 7], [5, 4], [9, 4], [14, 9], [19, 4], [23, 4], [26, 7], [26, 15], [14, 27], [2, 15]], col);
    r(5, 7, 5, 3, "#ffe1e9");
    r(4, 10, 3, 4, "#ffe1e9");
    g.restore();
  };
  ellipse(36, 66, 25, 4, "#1b102544");
  switch (name) {
    case "parcel":
      cube(8, 28, 53, 29, variant % 2 ? mint : lilac, "#ebd2f3", variant % 2 ? green : purple);
      r(27, 36, 9, 25, gold);
      r(29, 37, 2, 22, shine);
      p([[26, 34], [38, 27], [46, 27], [34, 34]], shine);
      r(5, 31, 43, 7, lilac);
      r(5, 37, 43, 2, purple);
      p([[47, 31], [64, 23], [64, 30], [47, 39]], purple);
      p([[5, 31], [20, 23], [64, 23], [47, 31]], "#ebd2f3");
      heart(20, 4, pink, 0.85);
      heart(34, 4, gold, 0.75);
      r(30, 24, 12, 8, rose);
      r(32, 24, 8, 3, shine);
      break;
    case "gavel":
      g.save();
      g.translate(34, 32);
      g.rotate(-0.55);
      r(-5, -3, 12, 37, ink);
      r(-3, -1, 8, 34, shade);
      r(-3, 0, 2, 29, gold);
      oct(-25, -19, 50, 24, ink);
      r(-21, -16, 42, 18, gold);
      r(-21, -16, 42, 4, shine);
      r(-22, -16, 7, 18, rose);
      r(15, -16, 7, 18, rose);
      r(-12, -14, 24, 3, "#ffe0a0");
      r(-18, -1, 36, 3, shade);
      g.restore();
      oct(8, 57, 56, 10, ink);
      r(12, 57, 48, 4, gold);
      break;
    case "horse": {
      const coat = [pink, lilac, mint][variant % 3], dark = [rose, purple, green][variant % 3];
      p([[13, 28], [19, 22], [44, 22], [44, 10], [51, 4], [56, 12], [63, 16], [66, 30], [59, 35], [48, 31], [46, 47], [42, 61], [35, 61], [33, 47], [24, 47], [20, 61], [13, 61], [15, 40], [7, 38], [5, 24], [9, 18], [13, 20]], ink);
      p([[17, 28], [22, 25], [46, 25], [46, 13], [51, 9], [54, 15], [60, 19], [62, 28], [58, 31], [47, 27], [43, 45], [39, 58], [37, 58], [37, 43], [22, 43], [17, 58], [15, 58], [19, 38]], coat);
      r(23, 26, 18, 3, "#ffe0e6");
      r(22, 31, 19, 13, dark);
      r(24, 30, 15, 8, gold);
      r(26, 31, 11, 2, shine);
      r(53, 19, 4, 4, ink);
      r(54, 19, 1, 1, shine);
      r(43, 13, 5, 15, dark);
      r(15, 58, 5, 3, dark);
      r(36, 58, 5, 3, dark);
      r(7, 22, 5, 14, dark);
      break;
    }
    case "stamp":
      oct(13, 7, 46, 57, ink);
      r(15, 9, 42, 53, shine);
      for (let i = 0; i < 6; i++) {
        r(11, 12 + i * 8, 5, 4, shine);
        r(56, 12 + i * 8, 5, 4, shine);
      }
      r(20, 14, 32, 42, lilac);
      r(22, 16, 28, 3, "#ebd2f3");
      heart(23, 22, pink, 0.8);
      r(25, 52, 22, 2, shine);
      break;
    case "bubble":
    case "marble": {
      const col = [pink, lilac, mint][variant % 3], dark = [rose, purple, green][variant % 3];
      const ball = [[24, 7], [48, 7], [48, 10], [56, 10], [56, 16], [62, 16], [62, 24], [65, 24], [65, 48], [62, 48], [62, 56], [56, 56], [56, 62], [48, 62], [48, 65], [24, 65], [24, 62], [16, 62], [16, 56], [10, 56], [10, 48], [7, 48], [7, 24], [10, 24], [10, 16], [16, 16], [16, 10], [24, 10]];
      p(ball, ink);
      g.save();
      g.translate(36, 36);
      g.scale(0.92, 0.92);
      g.translate(-36, -36);
      p(ball, dark);
      g.translate(-2, -2);
      g.scale(0.94, 0.94);
      p(ball, col);
      g.restore();
      r(20, 13, 21, 4, "#ffedf3");
      r(14, 20, 4, 15, "#ffedf3");
      r(17, 16, 6, 5, "#ffedf3");
      r(51, 35, 5, 13, dark);
      r(43, 49, 12, 5, dark);
      r(22, 56, 23, 3, "#e0bce4");
      r(25, 24, 7, 5, "#ffffff88");
      break;
    }
    case "chair":
      oct(14, 5, 44, 46, ink);
      oct(17, 8, 38, 39, purple);
      r(21, 10, 30, 29, rose);
      r(23, 12, 25, 3, pink);
      r(33, 18, 5, 5, gold);
      r(15, 43, 42, 15, ink);
      r(18, 44, 36, 10, lilac);
      r(20, 44, 31, 3, "#ebd2f3");
      r(8, 31, 13, 24, ink);
      r(51, 31, 13, 24, ink);
      r(11, 33, 7, 18, gold);
      r(54, 33, 7, 18, gold);
      r(13, 55, 6, 10, shade);
      r(53, 55, 6, 10, shade);
      break;
    case "blocks":
      cube(5, 42, 29, 17, lilac, "#ebd2f3", purple);
      cube(30, 42, 29, 17, mint, "#d8f0d5", green);
      cube(30, 23, 29, 17, pink, "#ffd6e3", rose);
      cube(30, 4, 29, 17, gold, shine, shade);
      break;
    case "charm":
      oct(25, 2, 22, 15, shade);
      oct(29, 4, 14, 10, gold);
      r(32, 6, 8, 5, ink);
      if (variant % 3 === 0) heart(9, 21, pink, 1.8);
      else if (variant % 3 === 1) {
        oct(13, 18, 47, 46, ink);
        oct(15, 20, 43, 42, lilac);
        oct(30, 18, 29, 34, ink);
        oct(33, 17, 29, 32, "#3b254a");
        r(19, 27, 4, 20, "#ebd2f3");
      } else {
        p([[36, 17], [42, 29], [62, 31], [48, 43], [52, 63], [36, 53], [20, 63], [24, 43], [10, 31], [30, 29]], ink);
        p([[36, 23], [40, 33], [55, 34], [44, 42], [47, 56], [36, 49], [25, 56], [28, 42], [17, 34], [33, 33]], gold);
        p([[36, 24], [40, 34], [34, 34], [29, 44], [29, 37], [20, 35], [33, 33]], shine);
      }
      break;
    case "car":
      oct(6, 29, 60, 29, ink);
      p([[14, 29], [22, 11], [48, 11], [58, 29]], ink);
      p([[20, 28], [26, 15], [45, 15], [52, 28]], "#bfe5ff");
      r(34, 14, 3, 15, purple);
      r(24, 18, 8, 3, "#f3ffff");
      r(9, 32, 54, 20, pink);
      r(11, 32, 50, 4, "#ffd6e3");
      r(12, 44, 48, 8, rose);
      r(12, 49, 12, 14, ink);
      r(48, 49, 12, 14, ink);
      r(16, 52, 5, 7, "#998aa4");
      r(51, 52, 5, 7, "#998aa4");
      r(8, 38, 9, 7, shine);
      r(55, 38, 9, 7, shine);
      r(26, 43, 20, 3, gold);
      break;
    case "card":
      oct(3, 14, 66, 44, ink);
      oct(6, 17, 60, 38, lilac);
      r(8, 19, 55, 3, "#ebd2f3");
      r(6, 27, 60, 8, purple);
      r(12, 39, 13, 10, gold);
      r(14, 41, 9, 2, shine);
      r(18, 39, 2, 10, shade);
      r(32, 43, 5, 3, shine);
      r(41, 43, 5, 3, shine);
      r(50, 43, 5, 3, shine);
      r(10, 53, 50, 2, "#a783c8");
      break;
    case "compass":
      oct(9, 5, 54, 60, shade);
      oct(12, 8, 48, 54, gold);
      oct(16, 12, 40, 46, ink);
      oct(18, 14, 36, 42, "#e8d9b9");
      p([[36, 16], [46, 43], [36, 36], [26, 43]], rose);
      p([[36, 55], [26, 28], [36, 36], [46, 28]], purple);
      r(34, 33, 5, 6, shine);
      r(23, 15, 10, 3, shine);
      break;
    case "note":
      r(34, 7, 9, 40, ink);
      r(39, 7, 23, 15, ink);
      r(38, 10, 5, 35, lilac);
      r(43, 10, 16, 8, pink);
      oct(15, 38, 28, 21, ink);
      oct(18, 40, 22, 16, lilac);
      r(21, 42, 10, 3, "#ebd2f3");
      r(9, 16, 3, 11, gold);
      r(5, 20, 11, 3, gold);
      break;
    case "pin":
      p([[29, 4], [43, 4], [47, 8], [47, 20], [43, 28], [47, 34], [54, 48], [54, 61], [49, 66], [23, 66], [18, 61], [18, 48], [25, 34], [29, 28], [25, 20], [25, 8]], ink);
      p([[30, 7], [42, 7], [44, 10], [44, 19], [40, 28], [44, 35], [50, 49], [50, 59], [47, 62], [25, 62], [22, 59], [22, 49], [28, 35], [32, 28], [28, 19], [28, 10]], "#fff0e1");
      r(28, 24, 16, 5, pink);
      r(29, 32, 15, 4, rose);
      r(25, 46, 4, 11, "#fffaff");
      r(45, 48, 4, 11, "#d4b8ca");
      break;
    case "tower":
      cube(9, 46, 54, 17, pink, "#ffd6e3", rose);
      cube(15, 27, 42, 17, lilac, "#ebd2f3", purple);
      cube(20, 8, 32, 17, mint, "#d8f0d5", green);
      r(23, 37, 4, 6, shine);
      r(32, 37, 4, 6, shine);
      r(20, 56, 4, 6, shine);
      r(31, 56, 4, 6, shine);
      break;
    case "pig":
      oct(10, 17, 52, 45, ink);
      p([[12, 23], [8, 5], [28, 13], [28, 25]], ink);
      p([[60, 23], [64, 5], [44, 13], [44, 25]], ink);
      p([[14, 20], [12, 11], [24, 16], [24, 24]], rose);
      p([[58, 20], [60, 11], [48, 16], [48, 24]], rose);
      oct(13, 20, 46, 39, pink);
      r(18, 24, 33, 3, "#ffd6e3");
      r(22, 32, 5, 6, ink);
      r(46, 32, 5, 6, ink);
      r(23, 32, 2, 2, shine);
      r(47, 32, 2, 2, shine);
      oct(24, 42, 27, 15, rose);
      r(27, 44, 20, 3, "#f6b6cd");
      r(30, 48, 3, 4, ink);
      r(42, 48, 3, 4, ink);
      p([[22, 19], [20, 3], [30, 9], [36, 1], [42, 9], [52, 3], [50, 19]], shade);
      p([[25, 16], [23, 7], [31, 12], [36, 5], [41, 12], [49, 7], [47, 16]], gold);
      r(27, 16, 19, 3, shine);
      r(34, 11, 4, 4, pink);
      break;
    default:
      coin(24, 23);
  }
  return image;
}
function pixelSprite(ctx, name, x, y, size = 64, variant = 0, angle = 0, alpha = 1) {
  const key = name + ":" + variant;
  if (!cache.has(key)) cache.set(key, make(name, variant));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cache.get(key), -size / 2, -size / 2, size, size);
  ctx.restore();
}
export {
  pixelSprite
};
