export const MODES = Object.freeze({
  bin: { name: "Bargain Bin", hook: "Pick four free wedges.", rule: "Your picks leave the wheel. Pay for the two wedges you did NOT pick.", spins: 4, icon: "gift" },
  sticky: { name: "Sticky Fingers", hook: "One free wedge.", rule: "Link the wedges, then spin for a free one. Every attached wedge costs extra.", spins: 3, icon: "ribbon" },
  cutting: { name: "Cutting Costs", hook: "Trim your bill.", rule: "Cut one wedge's price. That saving grows on BOTH other wedges.", spins: 3, icon: "flower" },
  rent: { name: "Rent Free", hook: "Your landed zone is rent-free.", rule: "Upgrade the zone where you land. Every OTHER active zone charges rent.", spins: 4, icon: "house" },
  seats: { name: "Double Booked", hook: "Four free bookings.", rule: "New bookings are free. Occupied wedges bump earlier bookings into paid upgrades.", spins: 4, icon: "chair" },
  baggage: { name: "Heavy Baggage", hook: "One combined booking.", rule: "The heaviest bag sets the rate for EVERY kilo in your booking.", spins: 4, icon: "parcel" },
  refund: { name: "Refund Pending", hook: "Your first purchase is fully refunded.", rule: "The refund is STORE CREDIT. Two redemption spins can spend beyond it.", spins: 3, icon: "receipt" },
  fall: { name: "Free Fall", hook: "Land in FREE.", rule: "FREE splits into two paid pointers on this wheel. Both picks count.", spins: 3, icon: "marble" },
});

const field = (key, label, count) => ({ key, label, type: count ? "list" : "number", ...(count ? { count } : {}), min: 0, max: 100000, step: 0.01 });
const openingField = field("openingValues", "Opening wheel amounts", 12);
export const SETTINGS_FIELDS = Object.freeze({
  bin: [field("prices", "Wedge prices A-F", 6), openingField],
  sticky: [field("price", "Price per attached wedge"), openingField],
  cutting: [field("price", "Starting price per wedge"), field("cut", "Amount snipped per spin"), openingField],
  rent: [field("rents", "Rent increase for each zone", 6), openingField],
  seats: [field("upgradeStep", "Increase per upgrade position"), openingField],
  baggage: [field("rateUnit", "Rate per heaviest kilogram"), openingField],
  refund: [field("prices", "Purchase amounts", 3), openingField],
  fall: [field("prices", "Paid wedge amounts", 3), openingField],
});

const OPENING = [10, 12, 8, 6, 10, 15, 5, 10, 8, 12, 6, 10];
const LETTERS = "ABCDEFG";
const STREETS = ["ROSE", "LILAC", "PEACH", "CHERRY", "MINT", "GOLD"];
const cash = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (values) => cash(values.reduce((total, value) => total + value, 0));
const clone = (value) => structuredClone(value);
const modeId = (value) => Object.hasOwn(MODES, value) ? value : "bin";

export function money(value) {
  const amount = typeof value === "number" && Number.isFinite(value) ? cash(value) : 0;
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 });
}

export function defaultSettings(mode) {
  return {
    openingValues: [...OPENING],
    ...clone({
      bin: { prices: [2, 4, 8, 12, 20, 30] },
      sticky: { price: 10 },
      cutting: { price: 10, cut: 10 },
      rent: { rents: [5, 10, 15, 5, 10, 15] },
      seats: { upgradeStep: 10 },
      baggage: { rateUnit: 1 },
      refund: { prices: [10, 20, 30] },
      fall: { prices: [10, 20, 30] },
    }[modeId(mode)]),
  };
}

function settingNumber(value, fallback) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 && number <= 100000 ? cash(number) : fallback;
}

export function normalizeSettings(mode, input) {
  const defaults = defaultSettings(mode);
  const supplied = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    Array.isArray(fallback)
      ? fallback.map((value, i) => settingNumber(Array.isArray(supplied[key]) ? supplied[key][i] : undefined, value))
      : settingNumber(supplied[key], fallback),
  ]));
}

function initialData(mode, settings) {
  return {
    bin: () => ({ remaining: [0, 1, 2, 3, 4, 5], removed: [], revealed: false }),
    sticky: () => ({ links: [], selected: null, connected: [], paid: [] }),
    cutting: () => ({ pots: [settings.price, settings.price, settings.price] }),
    rent: () => ({ rents: Array(6).fill(0), levels: Array(6).fill(0), current: null }),
    seats: () => ({ seats: Array(7).fill(null), guests: [], moved: [] }),
    baggage: () => ({ bags: [], weight: 0, heaviest: 0, rate: 0 }),
    refund: () => ({ purchase: 0, credit: 0, redemptions: [], cash: 0, expiredCredit: 0 }),
    fall: () => ({ drops: [], lastDrop: null }),
  }[mode]();
}

export function createRound(mode = "bin", settings, options = {}) {
  const id = modeId(mode), prices = normalizeSettings(id, settings);
  return {
    mode: id,
    settings: prices,
    phase: options.quick ? "ready" : "normal",
    step: 0,
    normalStep: 0,
    opening: 0,
    scam: 0,
    total: 0,
    quote: id === "cutting" ? cash(prices.price * 3) : 0,
    data: initialData(id, prices),
    last: null,
    ledger: [],
    scenario: ["story", "gentle", "big"].includes(options.scenario) ? options.scenario : "random",
    revealed: false,
  };
}

export function activateRound(round) {
  return round.phase === "ready" ? { ...round, phase: "active" } : round;
}

function item(id, label, sub, value, extra = {}) {
  return { id, label, sub, value, weight: 1, ...extra };
}

export function wheelItems(round) {
  if (round.phase === "normal" || round.phase === "ready") {
    return round.settings.openingValues.map((value, i) => item("normal-" + i, money(value), "", value, { kind: "cash" }));
  }
  const d = round.data, p = round.settings;
  switch (round.mode) {
    case "bin": return d.remaining.map((id) => item(id, money(p.prices[id]), "WEDGE " + LETTERS[id], p.prices[id], { kind: "gift" }));
    case "sticky": return Array.from({ length: 6 }, (_, id) => item(id, "WEDGE " + LETTERS[id], round.step < 2 ? "LINK THREE" : "FREE PICK", p.price, { kind: "prize" }));
    case "cutting": return d.pots.map((value, id) => item(id, ["ROSE", "LILAC", "MINT"][id], money(value), value, { kind: "flower" }));
    case "rent": return p.rents.map((value, id) => item(id, STREETS[id], "+" + money(value) + " RENT", value, { kind: "property" }));
    case "seats": return Array.from({ length: 4 }, (_, id) => item(id, "BOOK " + LETTERS[id], d.seats[id] === null ? "OPEN" : "OCCUPIED", 0, { kind: "seat" }));
    case "baggage": return Array.from({ length: 5 }, (_, id) => item(id, (id + 1) + " KG", "BAG", id + 1, { kind: "bag" }));
    case "refund": return p.prices.map((value, id) => item(id, money(value), round.step === 0 ? "BUY + RETURN" : "REDEEM", value, { kind: "purchase" }));
    case "fall": return [...p.prices.map((price, id) => item(id, money(price), "", price, { kind: "cash" })), item(3, "FREE", "", 0, { kind: "split" })];
  }
}

function randomIndex(length, rng) {
  const value = rng();
  return Math.min(length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * length)));
}

function extremeIndex(values, highest) {
  return values.reduce((best, value, index) => (highest ? value > values[best] : value < values[best]) ? index : best, 0);
}

function largestRentRoute(increments) {
  let best = -Infinity, route = [];
  function visit(rents, total, path) {
    if (path.length === 4) {
      if (total > best) { best = total; route = path; }
      return;
    }
    for (let id = 0; id < 6; id++) {
      const next = [...rents];
      next[id] = cash(next[id] + increments[id]);
      visit(next, cash(total + sum(next) - next[id]), [...path, id]);
    }
  }
  visit(Array(6).fill(0), 0, []);
  return route;
}

export function chooseIndex(round, rng = Math.random) {
  const items = wheelItems(round);
  if (round.scenario === "random") return randomIndex(items.length, rng);
  if (round.phase === "normal" || round.phase === "ready") return [0, 4][round.normalStep] ?? 0;
  const step = Math.min(round.step, MODES[round.mode].spins - 1), kind = round.scenario;
  if (round.mode === "bin") {
    const ids = kind === "story" ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5].sort((a, b) => (kind === "gentle" ? -1 : 1) * (round.settings.prices[a] - round.settings.prices[b]));
    return Math.max(0, items.findIndex((entry) => entry.id === ids[step]));
  }
  if (round.mode === "cutting") return kind === "story" ? step : kind === "gentle" ? extremeIndex(round.data.pots, false) : extremeIndex(round.data.pots, true);
  if (round.mode === "rent") return (kind === "story" ? [0, 1, 0, 2] : kind === "gentle" ? [0, 0, 0, 0] : largestRentRoute(round.settings.rents))[step];
  if (round.mode === "refund") return kind === "story" ? [1, 0, 2][step] : extremeIndex(round.settings.prices, kind === "big");
  if (round.mode === "fall") return kind === "story" ? [3, 0, 3][step] : kind === "gentle" ? extremeIndex(round.settings.prices, false) : 3;
  const sequences = {
    sticky: { story: [0, 2, 1], gentle: [0, 2, 5], big: [0, 2, 2] },
    seats: { story: [0, 0, 0, 0], gentle: [0, 1, 2, 3], big: [3, 3, 3, 3] },
    baggage: { story: [1, 0, 4, 1], gentle: [0, 0, 0, 0], big: [4, 4, 4, 4] },
  };
  return sequences[round.mode]?.[kind]?.[step] ?? 0;
}

function connectedPrizes(links, start) {
  const graph = Array.from({ length: 6 }, () => new Set());
  for (const link of links) {
    for (let i = 1; i < link.length; i++) { graph[link[i - 1]].add(link[i]); graph[link[i]].add(link[i - 1]); }
  }
  const found = new Set([start]), pending = [start];
  while (pending.length) {
    for (const neighbour of graph[pending.pop()]) {
      if (!found.has(neighbour)) { found.add(neighbour); pending.push(neighbour); }
    }
  }
  return [...found].sort((a, b) => a - b);
}

function fallDrop(round, lane, rng) {
  const primary = { lane, free: lane === 3, amount: lane === 3 ? 0 : round.settings.prices[lane] };
  const minis = [];
  if (primary.free) {
    for (let i = 0; i < 2; i++) {
      const picked = round.scenario === "random" ? randomIndex(3, rng)
        : round.scenario === "big" ? extremeIndex(round.settings.prices, true)
        : round.scenario === "gentle" ? extremeIndex(round.settings.prices, false)
        : round.step === 0 ? [0, 1][i] : [1, 2][i];
      minis.push({ lane: picked, amount: round.settings.prices[picked] });
    }
  }
  return { primary, minis, amount: sum([primary.amount, ...minis.map((pointer) => pointer.amount)]) };
}

export function land(round, index, rng = Math.random) {
  if (!["normal", "active"].includes(round.phase)) return round;
  const items = wheelItems(round), choice = Number.isInteger(index) ? items[index] : undefined;
  if (!choice) return round;
  const next = { ...round, data: clone(round.data), ledger: [...round.ledger] };
  const beforeData = clone(round.data);
  const event = { index, itemId: choice.id, kind: choice.kind, headline: "", detail: "", catch: false, amount: 0, quote: round.quote, beforeData };
  if (round.phase === "normal") {
    next.normalStep++;
    next.opening = cash(round.opening + choice.value);
    next.total = cash(next.opening + next.scam);
    next.phase = next.normalStep === 2 ? "ready" : "normal";
    event.amount = choice.value;
    event.headline = money(choice.value);
    event.detail = "Opening spin " + next.normalStep + " of 2. Banked for this round.";
    event.quote = next.quote;
    event.afterData = clone(next.data);
    next.last = event;
    next.ledger.push({ phase: "normal", step: next.normalStep, label: "Opening spin " + next.normalStep, amount: choice.value, total: next.total });
    return next;
  }
  next.step++;
  const done = next.step === MODES[next.mode].spins, d = next.data, p = next.settings;
  let quote = round.quote, amount = 0;
  switch (next.mode) {
    case "bin": {
      d.remaining = d.remaining.filter((id) => id !== choice.id);
      d.removed.push(choice.id);
      d.revealed = next.step >= 2;
      quote = sum(d.remaining.map((id) => p.prices[id]));
      Object.assign(event, { removedId: choice.id, remainingIds: [...d.remaining], catch: next.step === 2,
        headline: next.step === 2 ? "YOU OWE THE WEDGES LEFT BEHIND" : done ? "THE LEFTOVERS ARE YOURS" : "WEDGE " + LETTERS[choice.id] + " REMOVED",
        detail: done ? "Two wedges left: " + d.remaining.map((id) => money(p.prices[id])).join(" + ") + "." : "Your pick leaves the wheel. " + d.remaining.length + " wedges remain." });
      if (done) amount = quote;
      break;
    }
    case "sticky": {
      if (next.step < 3) {
        const link = [choice.id, (choice.id + 1) % 6, (choice.id + 2) % 6];
        d.links.push(link);
        Object.assign(event, { newLink: [...link], catch: next.step === 1, headline: next.step === 1 ? "ONE FREE. LINKED WEDGES EXTRA." : "THAT RIBBON IS CONNECTED",
          detail: link.map((id) => LETTERS[id]).join(" - ") + " joined. Attached wedges cost " + money(p.price) + " each." });
      } else {
        d.selected = choice.id;
        d.connected = connectedPrizes(d.links, choice.id);
        d.paid = d.connected.filter((id) => id !== choice.id);
        quote = cash(d.paid.length * p.price);
        amount = quote;
        Object.assign(event, { selected: choice.id, connected: [...d.connected], paid: [...d.paid], catch: d.paid.length > 0,
          headline: d.paid.length ? "IT DOES NOT LEAVE ALONE" : "ACTUALLY FREE",
          detail: "Wedge " + LETTERS[choice.id] + " is free. " + d.paid.length + " attached x " + money(p.price) + " = " + money(quote) + "." });
      }
      break;
    }
    case "cutting": {
      const from = [...d.pots], cut = Math.min(p.cut, d.pots[choice.id]);
      d.pots = d.pots.map((price, i) => cash(price + (i === choice.id ? -cut : cut)));
      quote = sum(d.pots);
      Object.assign(event, { pot: choice.id, cut, from, to: [...d.pots], receivers: [0, 1, 2].filter((id) => id !== choice.id), catch: cut > 0,
        headline: cut > 0 ? "YOUR SAVING GREW TWICE" : "NOTHING LEFT TO SNIP",
        detail: cut > 0 ? "Cut " + money(cut) + "; BOTH other wedges grow by " + money(cut) + "." : "This wedge is already zero. No prices change." });
      if (done) amount = quote;
      break;
    }
    case "rent": {
      const rentBefore = d.rents[choice.id];
      d.current = choice.id;
      d.rents[choice.id] = cash(rentBefore + choice.value);
      d.levels[choice.id]++;
      const charges = d.rents.flatMap((value, property) => property !== choice.id && value > 0 ? [{ property, amount: value }] : []);
      amount = sum(charges.map((charge) => charge.amount));
      quote = cash(round.scam + amount);
      Object.assign(event, { property: choice.id, rentBefore, rentAfter: d.rents[choice.id], charges, catch: charges.length > 0,
        headline: charges.length ? "ONLY THIS ZONE IS FREE" : "RENT FREE. FOR NOW.",
        detail: STREETS[choice.id] + " is exempt this turn. " + charges.length + " other " + (charges.length === 1 ? "zone charges " : "zones charge ") + money(amount) + "." });
      break;
    }
    case "seats": {
      const arrived = d.guests.length;
      d.guests.push({ id: arrived, seat: choice.id, moved: false, price: 0 });
      const movements = [];
      let guest = arrived, seat = choice.id;
      while (d.seats[seat] !== null) {
        const displaced = d.seats[seat];
        d.seats[seat] = guest;
        d.guests[guest].seat = seat;
        movements.push({ guest: displaced, from: seat, to: seat + 1, wasMoved: d.guests[displaced].moved });
        d.guests[displaced].moved = true;
        guest = displaced;
        seat++;
      }
      d.seats[seat] = guest;
      d.guests[guest].seat = seat;
      for (const occupant of d.guests) occupant.price = occupant.moved ? cash(occupant.seat * p.upgradeStep) : 0;
      d.moved = d.guests.filter((occupant) => occupant.moved).map((occupant) => occupant.id);
      quote = sum(d.guests.map((occupant) => occupant.price));
      Object.assign(event, { arrived, movements, guests: clone(d.guests), catch: movements.length > 0,
        headline: movements.length ? "FREE BOOKING. PAID UPGRADE." : "AN EMPTY WEDGE. STILL FREE.",
        detail: movements.length ? movements.length + " " + (movements.length === 1 ? "booking moves" : "bookings move") + ". Final upgrade quotes replace earlier quotes." : "Booking " + (arrived + 1) + " keeps its free stamp." });
      if (done) amount = quote;
      break;
    }
    case "baggage": {
      const oldWeight = d.weight, oldRate = d.rate;
      d.bags.push(choice.value);
      d.weight += choice.value;
      d.heaviest = Math.max(d.heaviest, choice.value);
      d.rate = cash(d.heaviest * p.rateUnit);
      quote = cash(d.weight * d.rate);
      const retagged = oldWeight > 0 && d.rate > oldRate;
      Object.assign(event, { weight: choice.value, oldRate, newRate: d.rate, oldWeight, retagged, catch: retagged,
        headline: retagged ? "HEAVIEST RATE. EVERY BAG." : next.step === 2 ? "ONE COMBINED BOOKING" : "BAG " + next.step + " PACKED",
        detail: d.weight + " kg x " + money(d.rate) + "/kg = " + money(quote) + "." });
      if (done) amount = quote;
      break;
    }
    case "refund": {
      const price = choice.value, creditBefore = d.credit;
      let creditUsed = 0, extra = price;
      if (next.step === 1) {
        d.purchase = price;
        d.credit = price;
        d.cash = price;
      } else {
        creditUsed = Math.min(d.credit, price);
        extra = cash(price - creditUsed);
        d.credit = cash(d.credit - creditUsed);
        d.cash = cash(d.cash + extra);
        d.redemptions.push({ price, creditUsed, extra });
      }
      const remainingCredit = d.credit;
      if (done) { d.expiredCredit = d.credit; d.credit = 0; }
      quote = d.cash;
      Object.assign(event, { price, creditBefore, creditAfter: d.credit, creditUsed, extra, remainingCredit, expiredCredit: d.expiredCredit, catch: next.step === 1,
        headline: next.step === 1 ? "STORE CREDIT. NOT CASH." : extra > 0 ? "YOUR REFUND RAN OUT" : "CREDIT COVERS THIS ONE",
        detail: next.step === 1 ? money(price) + " still owed. " + money(price) + " credit; two redemption spins follow." : money(creditUsed) + " credit used; " + money(extra) + " extra cash." + (done && d.expiredCredit > 0 ? " Unused " + money(d.expiredCredit) + " credit expires." : "") });
      if (done) amount = quote;
      break;
    }
    case "fall": {
      const drop = fallDrop(round, choice.id, rng);
      d.drops.push(drop);
      d.lastDrop = drop;
      quote = sum(d.drops.map((entry) => entry.amount));
      Object.assign(event, { drop, catch: drop.primary.free,
        headline: drop.primary.free ? "FREE SPLIT YOUR POINTER" : "ONE POINTER. ONE PRICE.",
        detail: drop.primary.free ? "FREE costs $0. Two paid pointers: " + drop.minis.map((pointer) => money(pointer.amount)).join(" + ") + " = " + money(drop.amount) + "." : "The wheel lands on " + money(drop.amount) + "." });
      if (done) amount = quote;
      break;
    }
  }
  next.quote = cash(quote);
  next.scam = cash(round.scam + amount);
  next.total = cash(next.opening + next.scam);
  next.phase = done ? "complete" : "active";
  next.revealed = round.revealed || event.catch;
  Object.assign(event, { amount: cash(amount), quote: next.quote, afterData: clone(d), final: done });
  next.last = event;
  if (amount !== 0 || done || next.mode === "rent") {
    next.ledger.push({ phase: "scam", step: next.step, label: next.mode === "rent" ? "Rent turn " + next.step : MODES[next.mode].name + " settled", amount: cash(amount), total: next.total });
  }
  return next;
}

export function roundStatus(round) {
  if (round.phase === "normal") return "Opening spin " + (round.normalStep + 1) + " of 2.";
  if (round.phase === "ready") return "Next spin activates " + MODES[round.mode].name + ".";
  if (round.phase === "complete") return "Round complete. Scam " + money(round.scam) + "; opening " + money(round.opening) + "; total " + money(round.total) + ".";
  const remaining = MODES[round.mode].spins - round.step;
  if (round.mode === "sticky") return round.step < 2 ? "Spin to lay ribbon " + (round.step + 1) + " of 2." : "Spin to pick the one free wedge.";
  if (round.mode === "refund" && round.step > 0) return remaining + " redemption " + (remaining === 1 ? "spin" : "spins") + " left. Credit " + money(round.data.credit) + ".";
  return remaining + " scam " + (remaining === 1 ? "spin" : "spins") + " left.";
}
