const def = (name, tag, rule, art, colors, showcase) => ({ name, tag, rule, short: rule, art, colors, showcase });
const EXTRA_MODES = {
  baggage: def("Heavy Baggage", "PACK LIGHT. PAY HEAVY.", "Collect parcels. All their weight ships at the heaviest parcel's rate.", "parcel", ["#9b79b0", "#b9879b", "#edc88f"], [0, 1, 4, 2]),
  auction: def("Going Twice", "SOLD. AND SOLD AGAIN.", "Raise the bids. At the hammer, the TWO highest bids join your bill.", "gavel", ["#9e6899", "#bd8c7e", "#ffe0a0"], [0, 3, 2, 5]),
  race: def("Photo Finish", "YOU BOUGHT THE WHOLE RACE.", "Move the drawn pony. First to the finish ends the race. Pay every pony's distance.", "horse", ["#8d80b8", "#b57d9e", "#c9ead6"], [0, 4, 2, 0, 1, 0]),
  stamps: def("Stamp Duty", "EVERY LINE HAS A PRICE.", "Stamp your square. Each completed row or column charges its value again, once.", "stamp", ["#9281ba", "#bd8c9a", "#ffe8b8"], [0, 1, 2, 4, 7, 8]),
  bubble: def("Bubble Trouble", "THE BIGGER THE POP...", "Pump the bubble. Every pop adds a bonus; spare air fills the next, bigger bubble.", "bubble", ["#b07ab1", "#7aada9", "#fbd0e6"], [3, 2, 3, 3, 1, 3]),
  seats: def("Double Booked", "SOMEONE'S IN YOUR SEAT.", "Seat a guest. Occupied seats push guests along. Pay a fee for each guest moved.", "chair", ["#955f93", "#b07ba5", "#e9c78e"], [0, 0, 0, 0, 4, 0]),
  blocks: def("Stack Attack", "THAT LINE COSTS EXTRA.", "Drop the blocks. Each block costs cash; complete rows clear and add a line fee.", "blocks", ["#8c72b9", "#ad72aa", "#a7e2d4"], [0, 1, 2, 3, 0, 1]),
  charms: def("Charm Offensive", "COLLECT THEM. REGRET IT.", "Buy a charm. Every duplicate raises the price of ALL copies of that charm.", "charm", ["#b77b98", "#9b81bc", "#ffe3a5"], [0, 1, 0, 2, 0, 1]),
  toll: def("Toll Troll", "EVERY ROAD LEADS TO FEES.", "Move your car. Pay every toll gate you pass, not just where you stop.", "car", ["#7e91ac", "#ac7ca1", "#ffe0a0"], [2, 3, 0, 3, 2]),
  credit: def("Credit Crunch", "YOUR LIMIT IS A SUGGESTION.", "Keep charging until the card declines. Every dollar over the limit is charged twice.", "card", ["#8b7db9", "#b77c9f", "#ffd98c"], [2, 1, 2, 1]),
  map: def("Wrong Turn", "THE SCENIC ROUTE COSTS MORE.", "Follow the compass to a priced tile. Wrapping off the map adds a detour fee.", "compass", ["#8a9e93", "#b3918b", "#ffe5b3"], [0, 1, 1, 1, 2, 3]),
  plinko: def("Plinko Princess", "A LITTLE DROP. A BIG BILL.", "Spin for a launch gate. Follow the marble; the lane it reaches joins your bill.", "marble", ["#8279b8", "#b176a6", "#ffe4af"], [2, 0, 4, 3]),
  encore: def("Encore Please", "ONE MORE SONG. ONE MORE BILL.", "Match the next note: C, E, G. Every note costs cash; each melody adds an encore fee.", "note", ["#9172b5", "#bd75a2", "#f9dba5"], [0, 1, 2, 3, 4, 5]),
  bowling: def("Royal Roll", "A STRIKE AGAINST YOUR WALLET.", "Knock down priced pins. Clear the rack for a strike fee, then a fresh rack appears.", "pin", ["#9d709e", "#a192bf", "#ffe7b8"], [0, 1, 4, 2]),
  tower: def("Tower Trouble", "YOU'RE PAYING FOR THE OFFCUTS.", "Stack a floor. Overhang falls away and costs extra. Stop when the tower falls or spins end.", "tower", ["#8f85b8", "#bb7f99", "#d3eed9"], [1, 3, 0, 2, 5]),
  boss: def("Boss Bill", "THE BOSS DROPS YOUR BILL.", "Attack the piggy boss. Heal landings prolong the fight. Defeat it to collect the bounty bill.", "pig", ["#ae7295", "#8d78b5", "#ffdca0"], [2, 6, 2, 1, 2, 2])
};
const isExtra = (mode) => !!EXTRA_MODES[mode];
const sum = (a) => a.reduce((n, v) => n + v, 0), cash = (s, n = 1) => Math.round(s.prices.cash * n), fee = (s, n = 1) => Math.round(s.prices.bonus * n);
const item = (label, sub, value, extra = {}) => ({ kind: "arcade", label, sub, value, ...extra });
function startExtra(s) {
  const n = s.prices.spins;
  const data = { baggage: { weights: [], weight: 0, rate: 0 }, auction: { bids: [] }, race: { distance: [0, 0, 0], finish: n + 3, winner: null }, stamps: { marks: Array(9).fill(0), lines: [] }, bubble: { air: 0, capacity: 6, pops: 0 }, seats: { occupied: Array(6).fill(false), moves: 0, standing: 0 }, blocks: { heights: Array(4).fill(0), lines: 0 }, charms: { counts: [0, 0, 0] }, toll: { position: 0, travel: 0, gates: 0 }, credit: { spent: 0, limit: cash(s, n * 3), over: 0 }, map: { x: 1, y: 1, path: [4], detours: 0 }, plinko: { drops: [], path: [] }, encore: { note: 0, songs: 0, notes: [] }, bowling: { pins: Array(10).fill(true), racks: 0 }, tower: { width: 8, x: 0, floors: [], waste: 0 }, boss: { hp: n * 3 + 3, max: n * 3 + 3, hits: 0, heals: 0 } }[s.mode];
  const extra = { baggage: 1, auction: 1, stamps: 3, bubble: 3, seats: 3, blocks: 3, charms: 3, toll: 2, map: 3, plinko: 1, encore: 3, bowling: 1, tower: 3 };
  return { data, spins: Object.hasOwn(extra, s.mode) ? n + extra[s.mode] : null };
}
function extraBoard(s) {
  const d = s.data;
  switch (s.mode) {
    case "baggage":
      return [1, 2, 3, 2, 5, 4].map((v) => item(v + " KG", "PARCEL", v));
    case "auction":
      return [1, 2, 3, 4, 6, 8].map((v) => item("$" + cash(s, v), "BID", cash(s, v)));
    case "race":
      return Array.from({ length: 6 }, (_, i) => item(["ROSE", "LILAC", "MINT"][i % 3], "+" + (i < 3 ? 2 : 1) + " STEPS", i < 3 ? 2 : 1, { runner: i % 3 }));
    case "stamps":
      return Array.from({ length: 9 }, (_, i) => item(String(i + 1), "$" + cash(s), cash(s), { cell: i }));
    case "bubble":
      return [1, 2, 3, 4, 2, 3].map((v) => item("+" + v, "AIR", v));
    case "seats":
      return Array.from({ length: 6 }, (_, i) => item("SEAT " + (i + 1), d.occupied[i] ? "OCCUPIED" : "OPEN", cash(s), { seat: i }));
    case "blocks":
      return Array.from({ length: 8 }, (_, i) => item("COL " + (i % 4 + 1), (i < 4 ? "2" : "1") + " BLOCKS", i < 4 ? 2 : 1, { column: i % 4 }));
    case "charms":
      return Array.from({ length: 6 }, (_, i) => item(["HEART", "MOON", "STAR"][i % 3], "CHARM", 1, { charm: i % 3 }));
    case "toll":
      return [1, 2, 3, 4, 2, 3].map((v) => item("+" + v, "MOVE", v));
    case "credit":
      return [1, 2, 3, 1, 2, 3].map((v) => item("$" + cash(s, v), "CHARGE", cash(s, v)));
    case "map":
      return ["NORTH", "EAST", "SOUTH", "WEST"].map((v, i) => item(v, "MOVE", 1, { direction: i }));
    case "plinko":
      return Array.from({ length: 6 }, (_, i) => item("GATE " + (i + 1), "DROP", 1, { gate: i }));
    case "encore":
      return Array.from({ length: 6 }, (_, i) => item(["C", "E", "G"][i % 3], "NOTE", cash(s), { note: i % 3 }));
    case "bowling":
      return ["LEFT", "RIGHT", "CENTRE", "CURVE", "STRIKE", "GUTTER"].map((v, i) => item(v, "BOWL", 1, { aim: i }));
    case "tower":
      return [[0, 0], [1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3, 1], [0, 0]].map(([v, dir]) => item(v === 0 ? "CENTRE" : (dir < 0 ? "LEFT " : "RIGHT ") + v, "STACK", v, { dir }));
    case "boss":
      return [1, 2, 3, 1, 2, 3, -2, -2].map((v) => item(v > 0 ? "HIT " + v : "HEAL 2", v > 0 ? "DAMAGE" : "UH OH", Math.abs(v), { heal: v < 0 }));
  }
}
function landExtra(s, item2, index, rng = Math.random) {
  const d = structuredClone(s.data), before = structuredClone(d), c = s.prices.cash, b = s.prices.bonus, entry = { headline: "", detail: "", amount: 0, lines: [] };
  let spins = s.spins === null ? null : s.spins - 1, complete = spins === 0;
  const add = (label, value) => {
    entry.lines.push({ label, value });
    entry.amount += value;
  };
  switch (s.mode) {
    case "baggage": {
      d.weights.push(item2.value);
      d.weight += item2.value;
      d.rate = Math.max(d.rate, item2.value);
      entry.headline = item2.value + " KG PARCEL";
      entry.detail = d.weight + " kg packed. Rate now $" + d.rate * c + " / kg.";
      if (complete) {
        add(d.weight + " kg at $" + d.rate * c + " / kg", d.weight * d.rate * c);
        entry.headline = "EVERY PARCEL PAYS THE HEAVY RATE";
      }
      break;
    }
    case "auction": {
      d.bids.push(item2.value);
      entry.headline = "BID $" + item2.value;
      entry.detail = "The two highest bids will both be charged.";
      if (complete) {
        const bids = [...d.bids].sort((a, b2) => b2 - a).slice(0, 2);
        bids.forEach((v, i) => add(i === 0 ? "Winning bid" : "Runner-up bid", v));
        entry.headline = "GOING TWICE. PAYING TWICE.";
      }
      break;
    }
    case "race": {
      const moved = Math.min(item2.value, d.finish - d.distance[item2.runner]);
      d.distance[item2.runner] += moved;
      entry.headline = ["ROSE", "LILAC", "MINT"][item2.runner] + " +" + moved;
      entry.detail = "First to " + d.finish + " ends the race. Every pony's distance counts.";
      if (d.distance[item2.runner] >= d.finish) {
        complete = true;
        d.winner = item2.runner;
        d.distance.forEach((v, i) => add(["Rose", "Lilac", "Mint"][i] + ": " + v + " steps", v * c));
        entry.headline = "PHOTO FINISH - ALL THREE BILLS";
      }
      break;
    }
    case "stamps": {
      d.marks[index] += c;
      add("Stamp " + (index + 1), c);
      const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];
      lines.forEach((line, i) => {
        if (line.every((v) => d.marks[v] > 0) && !d.lines.includes(i)) {
          d.lines.push(i);
          add((i < 3 ? "Row " + (i + 1) : "Column " + (i - 2)) + " duty", sum(line.map((v) => d.marks[v])));
        }
      });
      entry.headline = entry.lines.length > 1 ? "LINE COMPLETE. DUTY ADDED." : "STAMP " + (index + 1);
      entry.detail = "A full row or column is charged once more.";
      break;
    }
    case "bubble": {
      d.air += item2.value;
      add(item2.value + (item2.value === 1 ? " unit of air" : " units of air"), item2.value * c);
      entry.headline = "+" + item2.value + " AIR";
      while (d.air >= d.capacity) {
        d.air -= d.capacity;
        d.pops++;
        add("Pop " + d.pops + " bonus", c * (3 + d.pops));
        d.capacity += 2;
        entry.headline = "POP! BONUS ON THE BILL";
      }
      entry.detail = d.air + " / " + d.capacity + " air in the next bubble.";
      break;
    }
    case "seats": {
      let seat = index, moved = [];
      while (d.occupied[seat] && moved.length < 6) {
        moved.push(seat);
        seat = (seat + 1) % 6;
      }
      d.occupied[seat] = true;
      d.moves += moved.length;
      if (moved.length === 6) d.standing++;
      entry.moved = moved;
      entry.seat = seat;
      add("New guest", c);
      if (moved.length) add(moved.length + (moved.length === 1 ? " displaced guest" : " displaced guests"), moved.length * b);
      entry.headline = moved.length ? "MAKE ROOM. PAY THE MOVING FEES." : "GUEST SEATED";
      entry.detail = moved.length === 6 ? "Full house: " + d.standing + " standing-room guest" + (d.standing === 1 ? "" : "s") + "." : "Seat " + (index + 1) + " booked. " + moved.length + " guests moved.";
      break;
    }
    case "blocks": {
      d.heights[item2.column] += item2.value;
      add(item2.value + (item2.value === 1 ? " block" : " blocks"), item2.value * c);
      const rows = Math.min(...d.heights);
      if (rows) {
        d.heights = d.heights.map((v) => v - rows);
        d.lines += rows;
        add(rows + (rows === 1 ? " cleared row" : " cleared rows"), rows * c * 5);
      }
      entry.cleared = rows;
      if (Math.max(...d.heights) >= 10) {
        complete = true;
        add("Overflow cleanup", b * 10);
      }
      entry.headline = rows ? "LINE CLEAR - EXTRA CHARGE" : "BLOCKS LANDED";
      entry.detail = "Column " + (item2.column + 1) + ". " + d.lines + " rows cleared.";
      break;
    }
    case "charms": {
      const k = item2.charm, old = d.counts[k];
      d.counts[k]++;
      const price = c * (k + 1);
      add(["Heart", "Moon", "Star"][k] + " repriced collection", (d.counts[k] ** 2 - old ** 2) * price);
      entry.headline = old ? "EVERY COPY COSTS MORE" : "FIRST CHARM";
      entry.detail = d.counts[k] + " copies x $" + d.counts[k] * price + " = $" + d.counts[k] ** 2 * price + " for this charm.";
      break;
    }
    case "toll": {
      entry.stops = [];
      for (let step = 0; step < item2.value; step++) {
        d.position = (d.position + 1) % 12;
        d.travel++;
        entry.stops.push(d.position);
        if (d.position % 3 === 0) {
          const gate = d.position === 0 ? 4 : d.position / 3;
          d.gates++;
          add("Toll gate " + gate, c * gate);
        }
      }
      entry.headline = entry.amount ? "TOLL COLLECTED" : "CLEAR ROAD... FOR NOW";
      entry.detail = "Moved " + item2.value + " spaces. " + d.gates + " gates charged so far.";
      break;
    }
    case "credit": {
      d.spent += item2.value;
      add("Card purchase", item2.value);
      if (d.spent > d.limit) {
        d.over = d.spent - d.limit;
        add("Over-limit surcharge", d.over);
        complete = true;
      }
      entry.headline = complete ? "DECLINED. THE OVERDRAFT STILL COUNTS." : "APPROVED...";
      entry.detail = "$" + d.spent + " spent / $" + d.limit + " limit" + (complete ? ". Excess $" + d.over + " charged again." : ".");
      break;
    }
    case "map": {
      const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][item2.direction], x = d.x + dx, y = d.y + dy, wrap = x < 0 || x > 2 || y < 0 || y > 2;
      d.x = (x + 3) % 3;
      d.y = (y + 3) % 3;
      const pos = d.y * 3 + d.x;
      d.path.push(pos);
      add("Tile " + (pos + 1), c * [1, 2, 1, 3, 1, 2, 2, 3, 4][pos]);
      if (wrap) {
        d.detours++;
        add("Detour fee", c * 2);
      }
      entry.wrap = wrap;
      entry.headline = wrap ? "WRONG TURN. DETOUR CHARGE." : "TREASURE FOUND";
      entry.detail = "Tile " + (pos + 1) + ". " + d.detours + " detours so far.";
      break;
    }
    case "plinko": {
      let col = Math.min(4, item2.gate), path = [col];
      for (let j = 0; j < 6; j++) {
        const dir = s.scripted ? [1, -1, 1, -1, -1, 1][j] : rng() < 0.5 ? -1 : 1;
        col = Math.max(0, Math.min(4, col + dir));
        path.push(col);
      }
      const factors = [1, 3, 8, 3, 1];
      d.path = path;
      d.drops.push(col);
      add("Lane " + (col + 1), c * factors[col]);
      entry.headline = col === 2 ? "CENTRE LANE JACKPOT" : "MARBLE LANDED";
      entry.detail = "Gate " + (item2.gate + 1) + " to lane " + (col + 1) + ". Follow the bounce.";
      break;
    }
    case "encore": {
      const hit = item2.note === d.note;
      d.notes.push(item2.note);
      add("Note played", c);
      if (hit) d.note++;
      if (d.note === 3) {
        d.songs++;
        d.note = 0;
        add("Encore " + d.songs, c * 8);
      }
      entry.hit = hit;
      entry.headline = entry.lines.length > 1 ? "ENCORE! PLAY IT AGAIN." : hit ? "RIGHT NOTE" : "SOUR NOTE. STILL CHARGED.";
      entry.detail = "Next note: " + ["C", "E", "G"][d.note] + ". " + d.songs + " melodies charged.";
      break;
    }
    case "bowling": {
      const hits = [[0, 1, 3, 6], [0, 2, 5, 9], [0, 1, 2, 4, 7, 8], [2, 4, 5, 8, 9], Array.from({ length: 10 }, (_, i) => i), []][item2.aim];
      const fallen = hits.filter((i) => d.pins[i]);
      fallen.forEach((i) => d.pins[i] = false);
      entry.fallen = fallen;
      add(fallen.length + (fallen.length === 1 ? " pin" : " pins"), fallen.length * c);
      if (d.pins.every((v) => !v)) {
        d.racks++;
        add("Rack-clear fee", c * 5);
        entry.strike = true;
        if (!complete) d.pins = Array(10).fill(true);
      }
      entry.headline = entry.strike ? "RACK CLEARED. STRIKE FEE." : fallen.length ? fallen.length + " PINS DOWN" : "GUTTER. TRY AGAIN.";
      entry.detail = d.racks + " racks cleared. " + d.pins.filter(Boolean).length + " pins standing.";
      break;
    }
    case "tower": {
      const cut = Math.min(d.width, item2.value), remaining = d.width - cut;
      d.waste += cut;
      if (item2.dir > 0) d.x += cut;
      d.width = remaining;
      d.floors.push({ x: d.x, width: remaining, cut, dir: item2.dir });
      add("Floor: " + remaining + (remaining === 1 ? " block" : " blocks"), remaining * c);
      if (cut) add("Overhang cleanup: " + cut, cut * b);
      if (remaining === 0) complete = true;
      entry.headline = remaining === 0 ? "TOWER DOWN. CLEANUP IS EXTRA." : cut ? "OVERHANG BILLED" : "PERFECT FIT";
      entry.detail = remaining + " blocks wide. " + d.waste + " offcuts charged.";
      break;
    }
    case "boss": {
      if (item2.heal) {
        d.hp = Math.min(d.max, d.hp + item2.value);
        entry.healed = d.hp - before.hp;
        d.heals++;
        add("Boss recovery fee", b * 2);
        entry.headline = entry.healed ? "THE BOSS HEALS. YOU PAY." : "FULL HEALTH. RECOVERY FEE ANYWAY.";
      } else {
        d.hp = Math.max(0, d.hp - item2.value);
        d.hits++;
        add(item2.value + " damage", item2.value * c);
        entry.headline = item2.value === 3 ? "CRITICAL HIT" : "BOSS HIT";
      }
      if (d.hp === 0) {
        complete = true;
        add("Boss bounty", c * 5);
        entry.headline = "BOSS DEFEATED. BOUNTY BILLED.";
      }
      entry.detail = d.hp + " / " + d.max + " HP. " + d.heals + " heals.";
      break;
    }
  }
  return { data: d, spins, complete, entry: { ...entry, fx: { mode: s.mode, before, after: d, item: item2, index }, label: entry.headline } };
}
function extraStatus(s) {
  const d = s.data;
  if (!d) return ["READY", "0"];
  const map = { baggage: ["PACKED", d.weight + " KG"], auction: ["TOP BIDS", "$" + sum([...d.bids || []].sort((a, b) => b - a).slice(0, 2))], race: ["FINISH", String(d.finish)], stamps: ["LINES", String(d.lines?.length)], bubble: ["AIR", d.air + " / " + d.capacity], seats: ["GUESTS MOVED", String(d.moves)], blocks: ["LINES", String(d.lines)], charms: ["CHARMS", String(sum(d.counts || []))], toll: ["GATES", String(d.gates)], credit: ["LIMIT", "$" + d.limit], map: ["DETOURS", String(d.detours)], plinko: ["DROPS", String(d.drops?.length)], encore: ["NEXT NOTE", ["C", "E", "G"][d.note]], bowling: ["RACKS", String(d.racks)], tower: ["WIDTH", String(d.width)], boss: ["BOSS HP", String(d.hp)] };
  return map[s.mode];
}
export {
  EXTRA_MODES,
  extraBoard,
  extraStatus,
  isExtra,
  landExtra,
  startExtra
};
