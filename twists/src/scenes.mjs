export function sceneDuration(round) {
  const last = round?.last;
  if (!last || round.phase === "normal" || last.kind === "normal") return 1800;
  if (round.mode === "fall") return last.drop?.primary?.free ? 7200 : 3900;
  if (round.mode === "sticky") return round.step === 3 ? 5700 : 3600;
  if (round.mode === "refund") return round.step === 1 ? 5400 : 4500;
  if (round.mode === "baggage") return last.newRate > last.oldRate && last.oldWeight > 0 ? 5000 : 3400;
  if (round.mode === "cutting") return last.cut > 0 ? 4700 : 2300;
  if (round.mode === "seats") return last.movements?.length ? 4700 : 2800;
  if (round.mode === "bin") return round.step === 2 ? 4700 : 3500;
  return 3800;
}
