import {money} from './model.mjs';

const TAU = Math.PI * 2;
const X = 450, Y = 445, R = 337;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const phase = (value, start, end) => ease((value - start) / (end - start));
const mix = (from, to, progress) => from + (to - from) * progress;
const modulo = value => ((value % TAU) + TAU) % TAU;
const point = (angle, radius) => ({x: X + Math.cos(angle) * radius, y: Y + Math.sin(angle) * radius});
const angleOf = (args, index) => -Math.PI + (index + .5) * TAU / args.items.length + args.rotation * Math.PI / 180;

function circle(ctx, x, y, radius, fill, stroke, width = 2) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function cutBox(ctx, x, y, width, height, fill, stroke, lineWidth = 2, cut = 7) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y); ctx.lineTo(x + width - cut, y);
  ctx.lineTo(x + width, y + cut); ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height); ctx.lineTo(x + cut, y + height);
  ctx.lineTo(x, y + height - cut); ctx.lineTo(x, y + cut); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color, width = 220) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `1000 ${size}px Nunito`;
  while (ctx.measureText(String(value)).width > width && size > 13) {
    size--; ctx.font = `1000 ${size}px Nunito`;
  }
  ctx.fillStyle = color; ctx.fillText(String(value), x, y, width); ctx.restore();
}

function sector(ctx, angle, half, inner, outer, fill, stroke, width = 2) {
  ctx.beginPath(); ctx.arc(X, Y, outer, angle - half, angle + half);
  ctx.arc(X, Y, inner, angle + half, angle - half, true); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function arc(ctx, from, to, radius, color, width = 4, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.beginPath(); ctx.arc(X, Y, radius, from, to);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
}

function sparkle(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 6, y - size / 2, size / 3, size);
  ctx.fillRect(x - size / 2, y - size / 6, size, size / 3);
}

function stamp(ctx, x, y, title, value, theme, color, width = 106, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  cutBox(ctx, -width / 2, -29 + 4, width, 58, theme.ink);
  cutBox(ctx, -width / 2, -29, width, 58, theme.ink, color, 3);
  text(ctx, title, 0, -12, 16, theme.cream, width - 12);
  text(ctx, value, 0, 12, 24, color, width - 12);
  ctx.restore();
}

function highlight(ctx, args, index, strength = 1, color = args.theme.gold) {
  if (!Number.isInteger(index) || index < 0 || index >= args.items.length) return;
  const angle = angleOf(args, index), half = Math.PI / args.items.length - .025;
  ctx.save(); ctx.globalAlpha *= strength;
  sector(ctx, angle, half, 97, 331, null, color, 4);
  ctx.globalAlpha *= .13; sector(ctx, angle, half, 97, 331, color);
  ctx.restore();
}

function bookingChip(ctx, x, y, guest, theme, flip = 1, oldGuest = guest) {
  const next = flip >= .5, occupant = next ? guest : oldGuest;
  const compression = flip > 0 && flip < 1 ? Math.max(.12, Math.abs(Math.cos(Math.PI * flip))) : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, compression);
  circle(ctx, 0, 0, 25, theme.ink, occupant.moved ? theme.gold : theme.mint, 3);
  text(ctx, '#' + (occupant.id + 1), 0, -10, 14, theme.cream, 36);
  text(ctx, occupant.moved ? money(occupant.price) : 'FREE', 0, 9, 17, occupant.moved ? theme.gold : theme.mint, 36);
  ctx.restore();
}

function drawBookings(ctx, args) {
  const {round, theme, reduced, spinning} = args;
  const p = reduced || spinning ? 1 : args.progress;
  const event = round.last?.kind === 'seat' ? round.last : null;
  const data = round.data, before = event?.beforeData || data;
  const movements = event?.movements || [];
  const ringAngle = seat => -Math.PI / 2 + seat * TAU / 7;
  const stage = phase(p, .28, .88);

  // This seven-position track records upgrades; the four actual entry wedges remain intact.
  for (let seat = 0; seat < 7; seat++) {
    const a = ringAngle(seat), position = point(a - .28, 319);
    const movedHere = movements.some(move => move.to === seat) && p >= .42;
    sector(ctx, a, Math.PI / 7 - .015, 282, 334, theme.ink, movedHere ? theme.gold : theme.lilac, movedHere ? 3 : 1.5);
    text(ctx, String.fromCharCode(65 + seat), position.x, position.y, 16, theme.cream, 24);
    if (!data.guests?.length) {
      const dot = point(a, 309); circle(ctx, dot.x, dot.y, 5, theme.lilac);
    }
  }

  if (!event || spinning) {
    for (const guest of data.guests || []) {
      const at = point(ringAngle(guest.seat), 309);
      bookingChip(ctx, at.x, at.y, guest, theme);
    }
    return;
  }

  const selectedAngle = angleOf(args, event.index);
  if (p < .48) {
    const a = phase(p, .01, .12) * (1 - phase(p, .32, .48));
    const at = point(selectedAngle, 153);
    ctx.save(); ctx.globalAlpha *= a;
    stamp(ctx, at.x, at.y, 'BOOKING #' + (event.arrived + 1), 'FREE', theme, theme.mint, 115, .88 + .12 * a);
    ctx.restore();
  }

  movements.forEach((move, index) => {
    const t = phase(p, .35 + index * .065, .67 + index * .065);
    if (t <= 0 || t >= 1) return;
    const from = ringAngle(move.from), to = ringAngle(move.to);
    arc(ctx, from, mix(from, to, t), 287, theme.gold, 6, .75);
    const tip = point(mix(from, to, t), 287);
    sparkle(ctx, tip.x, tip.y, 10, theme.cream);
  });

  for (const guest of data.guests || []) {
    if (guest.id === event.arrived) continue;
    const previous = before.guests?.find(value => value.id === guest.id) || guest;
    const index = movements.findIndex(move => move.guest === guest.id);
    const travel = index < 0 ? 1 : phase(p, .35 + index * .065, .67 + index * .065);
    const a = mix(ringAngle(previous.seat), ringAngle(guest.seat), travel);
    const at = point(a, 309);
    const flip = index < 0 ? 1 : phase(p, .53 + index * .065, .76 + index * .065);
    bookingChip(ctx, at.x, at.y, guest, theme, flip, previous);
  }

  const newcomer = data.guests?.find(guest => guest.id === event.arrived);
  if (newcomer && p > .2) {
    const travel = phase(p, .22, .52);
    const target = ringAngle(newcomer.seat);
    const delta = Math.atan2(Math.sin(target - selectedAngle), Math.cos(target - selectedAngle));
    const at = point(selectedAngle + delta * travel, mix(154, 309, travel));
    ctx.save(); ctx.globalAlpha *= phase(p, .2, .27);
    bookingChip(ctx, at.x, at.y, newcomer, theme);
    ctx.restore();
  }
  if (movements.length && stage > 0 && stage < 1) {
    const at = point(ringAngle(movements.at(-1).to), 148);
    ctx.save(); ctx.globalAlpha *= Math.sin(stage * Math.PI);
    text(ctx, 'BUMP!', at.x, at.y, 22, theme.cream, 112); ctx.restore();
  }
}

function bagChip(ctx, x, y, index, weight, rate, theme, flip = 1, oldRate = rate, scale = 1) {
  const showNew = flip >= .5;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  cutBox(ctx, -48, -29, 96, 58, theme.ink, theme.cream, 2.5);
  text(ctx, weight + ' KG', 0, -12, 21, theme.cream, 82);
  text(ctx, '#' + (index + 1), -34, -24, 11, theme.lilac, 25);
  ctx.save(); ctx.translate(0, 13);
  const compression = flip > 0 && flip < 1 ? Math.max(.08, Math.abs(Math.cos(Math.PI * flip))) : 1;
  ctx.scale(1, compression);
  cutBox(ctx, -43, -11, 86, 25, theme.ink, showNew ? theme.gold : theme.lilac, 1.5, 4);
  text(ctx, money(weight * (showNew ? rate : oldRate)), 0, 2, 21, showNew ? theme.gold : theme.cream, 77);
  ctx.restore(); ctx.restore();
}

function drawBaggage(ctx, args) {
  const {round, theme, reduced, spinning} = args;
  const p = reduced || spinning ? 1 : args.progress;
  const event = round.last?.kind === 'bag' ? round.last : null;
  const data = round.data, bags = data.bags || [];
  const wheelRotation = args.rotation * Math.PI / 180;
  const slotAngle = index => -Math.PI / 2 + index * Math.PI / 2 + wheelRotation;
  const selected = event ? angleOf(args, event.index) : -Math.PI / 2;
  const sweep = phase(p, .34, .89);
  const retagging = event?.retagged && !spinning;

  ctx.save(); ctx.globalAlpha *= .68;
  sector(ctx, 0, Math.PI, 101, 190, theme.ink);
  ctx.restore();
  circle(ctx, X, Y, 190, null, theme.lilac, 2);

  if (event && !spinning && p < .33) highlight(ctx, args, event.index, 1 - phase(p, .15, .33), theme.mint);
  if (retagging && sweep > 0 && sweep < 1) {
    const sweepAngle = selected + sweep * TAU;
    ctx.save(); ctx.globalAlpha *= .11;
    sector(ctx, sweepAngle - .10, .10, 97, 330, theme.gold);
    ctx.restore();
    arc(ctx, selected, sweepAngle, 188, theme.gold, 5, .9);
    arc(ctx, selected, sweepAngle, 326, theme.gold, 5, .9);
    const inner = point(sweepAngle, 99), outer = point(sweepAngle, 328);
    ctx.beginPath(); ctx.moveTo(inner.x, inner.y); ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = theme.cream; ctx.lineWidth = 3; ctx.stroke();
    sparkle(ctx, outer.x, outer.y, 13, theme.gold);
  }

  bags.forEach((weight, index) => {
    const newest = event && index === bags.length - 1 && !spinning;
    const target = slotAngle(index);
    let at = point(target, 148), scale = 1;
    if (newest) {
      const travel = phase(p, .08, .34);
      if (p < .08) return;
      const delta = Math.atan2(Math.sin(target - selected), Math.cos(target - selected));
      at = point(selected + delta * travel, mix(218, 148, travel));
      scale = .86 + .14 * travel;
    }
    const threshold = modulo(target - selected) / TAU;
    const flip = retagging && !newest ? phase(sweep, Math.max(0, threshold - .07), Math.min(1, threshold + .11)) : 1;
    bagChip(ctx, at.x, at.y, index, weight, data.rate, theme, flip, event?.oldRate ?? data.rate, scale);
  });

  const shownRate = event && !spinning && p < .34 ? event.oldRate : data.rate;
  const label = bags.length ? 'RATE ' + money(shownRate) + ' / KG' : 'ONE COMBINED BOOKING';
  cutBox(ctx, 327, 710, 246, 44, theme.ink, retagging && sweep > 0 ? theme.gold : theme.cream, 2.5);
  text(ctx, label, X, 733, 20, theme.cream, 226);
  if (retagging && p >= .34 && p < .92) {
    const at = point(selected, 295);
    ctx.save(); ctx.globalAlpha *= phase(p, .34, .44) * (1 - phase(p, .8, .92));
    stamp(ctx, at.x, at.y, 'EVERY BAG', 'REPRICED', theme, theme.gold, 124);
    ctx.restore();
  }
}

function lock(ctx, x, y, number, locked, theme, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  circle(ctx, 0, 0, 28, theme.ink, locked ? theme.gold : theme.mint, 3);
  ctx.beginPath();
  ctx.moveTo(locked ? -9 : -14, -2); ctx.lineTo(locked ? -9 : -14, -11);
  ctx.quadraticCurveTo(locked ? -9 : -14, -23, locked ? 0 : -5, -23);
  ctx.quadraticCurveTo(locked ? 9 : 4, -23, locked ? 9 : 4, -11);
  if (locked) ctx.lineTo(9, -2);
  ctx.strokeStyle = locked ? theme.gold : theme.mint; ctx.lineWidth = 4; ctx.stroke();
  cutBox(ctx, -15, -4, 30, 25, theme.ink, locked ? theme.gold : theme.mint, 2, 3);
  text(ctx, locked ? number : 'OK', 0, 9, locked ? 20 : 13, theme.cream, 25);
  ctx.restore();
}

function shutter(ctx, args, progress) {
  const close = phase(progress, .31, .49), open = phase(progress, .52, .69);
  if (close === 0 || open === 1) return;
  const strength = close * (1 - open), divisions = 12;
  for (let i = 0; i < divisions; i++) {
    const angle = -Math.PI / 2 + i * TAU / divisions;
    const half = Math.PI / divisions * strength;
    ctx.save(); ctx.globalAlpha *= .96;
    sector(ctx, angle, half, 93, 333, i % 2 ? args.theme.ink : '#50385f', args.theme.lilac, 1.5);
    ctx.restore();
  }
  if (progress > .44 && progress < .64) {
    const alpha = phase(progress, .44, .49) * (1 - phase(progress, .58, .64));
    ctx.save(); ctx.globalAlpha *= alpha;
    cutBox(ctx, 300, 241, 300, 72, args.theme.ink, args.theme.gold, 3);
    text(ctx, 'STORE CREDIT', X, 277, 31, args.theme.cream, 280);
    ctx.restore();
  }
}

function drawRefund(ctx, args) {
  const {round, theme, reduced, spinning} = args;
  const p = reduced || spinning ? 1 : args.progress;
  const event = round.last?.kind === 'purchase' ? round.last : null;
  if (!round.step || !event) return;
  const first = round.step === 1;
  const before = event.beforeData || round.data;
  const visible = first && !spinning ? phase(p, .63, .76) : 1;
  const credit = first ? round.data.credit : p < .47 && !spinning ? before.credit
    : round.phase === 'complete' && p < .85 && !spinning ? event.remainingCredit : round.data.credit;
  const cash = p < .73 && !spinning && !first ? before.cash : round.data.cash;
  const selected = angleOf(args, event.index);

  if (first && !spinning) {
    if (p < .38) {
      highlight(ctx, args, event.index, 1 - phase(p, .28, .38), theme.mint);
      const at = point(selected, 228), alpha = phase(p, .01, .12) * (1 - phase(p, .29, .38));
      ctx.save(); ctx.globalAlpha *= alpha;
      stamp(ctx, at.x, at.y, 'REFUND APPROVED', money(event.price), theme, theme.mint, 188, .94 + .06 * alpha);
      ctx.restore();
    }
    shutter(ctx, args, p);
  }

  if (visible > 0) {
    ctx.save(); ctx.globalAlpha *= visible;
    stamp(ctx, 275, 445, round.phase === 'complete' && event.expiredCredit > 0 && p > .85 ? 'CREDIT EXPIRED' : 'CREDIT LEFT', money(credit), theme, theme.mint, 144);
    stamp(ctx, 625, 445, 'CASH OWED', money(cash), theme, theme.gold, 144);
    for (let i = 0; i < 2; i++) {
      const at = point(Math.PI * (.38 + i * .24), 301);
      const consumed = Math.max(0, round.step - 1) - (p < .66 && !spinning && !first ? 1 : 0);
      lock(ctx, at.x, at.y, i + 1, i >= consumed, theme, .9 + .1 * visible);
    }
    text(ctx, 'REDEMPTION SPINS', X, 757, 18, theme.cream, 215);
    ctx.restore();
  }

  if (!first && !spinning) {
    const flight = phase(p, .1, .5);
    if (event.creditUsed > 0 && flight > 0 && flight < 1) {
      const delta = modulo(selected - Math.PI), angle = Math.PI + delta * flight;
      const at = point(angle, 175 + Math.sin(flight * Math.PI) * 35);
      arc(ctx, Math.PI, angle, 185, theme.mint, 4, .65);
      stamp(ctx, at.x, at.y, 'CREDIT USED', money(event.creditUsed), theme, theme.mint, 126);
    }
    if (event.extra > 0 && p > .56) {
      const at = point(selected, 151), alpha = phase(p, .56, .7);
      ctx.save(); ctx.globalAlpha *= alpha;
      stamp(ctx, at.x, at.y, 'EXTRA CASH', '+' + money(event.extra), theme, theme.gold, 135, .9 + .1 * alpha);
      ctx.restore();
    } else if (event.extra === 0 && p >= .55) {
      const at = point(selected, 151);
      ctx.save(); ctx.globalAlpha *= phase(p, .55, .7);
      stamp(ctx, at.x, at.y, 'CREDIT', 'COVERED', theme, theme.mint, 122);
      ctx.restore();
    }
  }
}

function miniPointer(ctx, angle, radius, number, theme, color, scale = 1) {
  const at = point(angle, radius);
  ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(angle + Math.PI / 2); ctx.scale(scale, scale);
  ctx.beginPath(); ctx.moveTo(-14, -17); ctx.lineTo(14, -17);
  ctx.lineTo(18, -5); ctx.lineTo(0, 24); ctx.lineTo(-18, -5); ctx.closePath();
  ctx.fillStyle = theme.ink; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
  text(ctx, number, at.x, at.y - 2, 18, theme.cream, 25);
}

function drawFall(ctx, args) {
  const {round, theme, reduced, spinning} = args;
  const p = reduced ? 1 : args.progress;
  const event = round.last?.kind === 'split' || round.last?.kind === 'cash' ? round.last : null;
  const drop = event?.drop;
  if (!drop || spinning) return;
  const selected = angleOf(args, drop.primary.lane);
  if (!drop.primary.free) {
    highlight(ctx, args, drop.primary.lane, .75, theme.gold);
    const at = point(selected, 151);
    ctx.save(); ctx.globalAlpha *= phase(p, .12, .32);
    stamp(ctx, at.x, at.y, 'ONE PICK', '+' + money(drop.primary.amount), theme, theme.gold, 120);
    ctx.restore();
    return;
  }

  highlight(ctx, args, drop.primary.lane, p < .28 ? 1 : .35, p < .28 ? theme.mint : theme.gold);
  if (p < .5) {
    const fracture = phase(p, .24, .45), at = point(selected, 228);
    const alpha = 1 - phase(p, .4, .5);
    for (let half = 0; half < 2; half++) {
      const direction = half ? 1 : -1;
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.translate(at.x + Math.cos(selected + Math.PI / 2) * direction * fracture * 23,
        at.y + Math.sin(selected + Math.PI / 2) * direction * fracture * 23);
      ctx.rotate(direction * fracture * .13);
      ctx.beginPath(); ctx.rect(half ? 0 : -81, -39, 81, 78); ctx.clip();
      cutBox(ctx, -80, -37, 160, 74, theme.ink, theme.mint, 3);
      text(ctx, 'FREE!', 0, 1, 39, theme.cream, 146);
      ctx.restore();
    }
  }

  if (p >= .24 && p < .62) {
    const fracture = phase(p, .24, .42), alpha = 1 - phase(p, .48, .62);
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = 112 + i * 24, a = selected + (i % 2 ? .022 : -.022) * fracture;
      const at = point(a, radius);
      if (!i) ctx.moveTo(at.x, at.y); else ctx.lineTo(at.x, at.y);
    }
    ctx.strokeStyle = theme.ink; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = theme.gold; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }

  const landed = [];
  drop.minis.forEach((pick, index) => {
    const start = .32 + index * .08, end = .73 + index * .13;
    if (p < start) return;
    const travel = phase(p, start, end), target = angleOf(args, pick.lane);
    const finish = selected + TAU + modulo(target - selected);
    const angle = mix(selected, finish, travel), radius = 314 - index * 33;
    const color = index ? theme.mint : theme.gold;
    if (travel < 1 && !reduced) {
      arc(ctx, Math.max(selected, angle - 1.7), angle, radius, color, 5, .8);
      const spark = point(angle - .12, radius);
      sparkle(ctx, spark.x, spark.y, 9, theme.cream);
    }
    if (travel === 1) {
      const half = Math.PI / args.items.length - .04;
      arc(ctx, target - half, target + half, 328 - index * 12, color, 7);
      landed.push({...pick, number: index + 1, color});
    }
    miniPointer(ctx, angle, radius, index + 1, theme, color, .65 + .35 * phase(p, start, start + .08));
  });

  const grouped = new Map();
  landed.forEach(pick => grouped.set(pick.lane, [...(grouped.get(pick.lane) || []), pick]));
  for (const [lane, picks] of grouped) {
    const at = point(angleOf(args, lane), 153);
    stamp(ctx, at.x, at.y, picks.length > 1 ? 'BOTH PICKS' : 'PICK ' + picks[0].number,
      picks.map(pick => money(pick.amount)).join(' + '), theme, picks[0].color, picks.length > 1 ? 146 : 112);
  }
  if (p >= .48) {
    const at = point(selected, 151);
    ctx.save(); ctx.globalAlpha *= phase(p, .48, .64);
    stamp(ctx, at.x, at.y, 'FREE SPLIT', '2 PICKS', theme, theme.cream, 120);
    ctx.restore();
  }
}

export function drawEffectB(ctx, args) {
  const draw = {seats: drawBookings, baggage: drawBaggage, refund: drawRefund, fall: drawFall}[args.round.mode];
  if (!draw) return false;
  ctx.save();
  ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.clip();
  draw(ctx, args);
  ctx.restore();
  return true;
}
