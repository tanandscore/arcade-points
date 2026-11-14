// Midnight Burn — Upgrade 134: the spoils pick after a Blacklist win, strikes and the impound yard, and the police radio.
// Plain data and plain functions (given a dice roll), so every rule can be tested on its own. Saved inside the career.

// ---------------------------------------------------------------- THE SPOILS ----------------------------------------------------------------
// Beat a Blacklist rival and six cards are dealt face down. You turn over two and keep them.
// (The rival's car is still handed over as before; the cards are on top of that.)
export const SPOIL_PICKS = 2;
export const SPOIL_INFO = {
  jackpot: { icon: "💰", name: "THE STASH", text: "The rival's hidden cash" },
  cash: { icon: "💵", name: "CASH", text: "Race winnings on the side" },
  bail: { icon: "🃏", name: "BAIL CARD", text: "Next time you are busted: no fine, no strike" },
  release: { icon: "📄", name: "RELEASE PAPER", text: "Frees one car from the impound yard, or wipes a strike" },
  rep: { icon: "📈", name: "STREET TALK", text: "Word of the win spreads: notoriety" },
};
export function spoilDeck(rank, rnd) {
  const base = 3000 + (16 - rank) * 2200; // #15 pays about 5,200, #1 about 36,000
  const cards = [
    { k: "jackpot", n: Math.round(base * 2.5 / 100) * 100 }, { k: "cash", n: Math.round(base / 100) * 100 }, { k: "cash", n: Math.round(base * 0.5 / 100) * 100 },
    { k: "bail", n: 1 }, { k: "release", n: 1 }, { k: "rep", n: Math.round((2000 + (16 - rank) * 2500) / 100) * 100 },
  ];
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { rank, cards, picked: [], left: SPOIL_PICKS };
}
// Turn one card over. Changes the career and returns the card (or null if that pick is not allowed).
export function pickSpoil(career, rivalId, i) {
  const S = career.spoils && career.spoils[rivalId]; if (!S || S.left <= 0 || S.picked.includes(i) || !S.cards[i]) return null;
  const c = S.cards[i]; S.picked.push(i); S.left--;
  const tk = career.tokens || (career.tokens = { bail: 0, release: 0 });
  if (c.k === "jackpot" || c.k === "cash") { career.cash += c.n; career.earned = (career.earned || 0) + c.n; }
  else if (c.k === "bail") tk.bail = (tk.bail || 0) + 1;
  else if (c.k === "release") tk.release = (tk.release || 0) + 1;
  else if (c.k === "rep") { const W = career.wanted || (career.wanted = { v: 1, n: 0, cost: 0, chases: 0, charges: {}, best: { n: 0, cost: 0, charges: 0 }, last: null }); W.n += c.n; }
  return c;
}
export const pendingSpoils = (career) => { for (const [id, S] of Object.entries(career.spoils || {})) if (S.left > 0) return { id, ...S }; return null; };

// ---------------------------------------------------------------- STRIKES AND THE IMPOUND YARD ----------------------------------------------------------------
// Every bust puts a strike on the car you were driving. Three strikes and that car is impounded: it sits in the yard until you pay to get it out.
// You can never lose your last free car: with nothing else to drive, the third strike is turned into a double fine instead.
export const MAX_STRIKES = 3;
export const releaseFee = (price) => Math.max(2500, Math.round((price || 0) * 0.12 / 100) * 100);
export const strikesOf = (career, id) => ((career.strikes || {})[id] || 0);
export const isImpounded = (career, id) => !!(career.impound || {})[id];
export const freeCars = (career) => (career.carsOwned || []).filter((id) => !isImpounded(career, id));
// A bust. Returns { bail, strikes, impounded, lastCar, fineMult, switchTo }.
export function applyBust(career) {
  const tk = career.tokens || (career.tokens = { bail: 0, release: 0 });
  if ((tk.bail || 0) > 0) { tk.bail--; return { bail: true, strikes: strikesOf(career, career.car), impounded: false, lastCar: false, fineMult: 0, switchTo: null }; }
  const st = career.strikes || (career.strikes = {}); const id = career.car; st[id] = Math.min(MAX_STRIKES, (st[id] || 0) + 1);
  if (st[id] < MAX_STRIKES) return { bail: false, strikes: st[id], impounded: false, lastCar: false, fineMult: 1, switchTo: null };
  const others = freeCars(career).filter((c) => c !== id);
  if (!others.length) { st[id] = MAX_STRIKES - 1; return { bail: false, strikes: st[id], impounded: false, lastCar: true, fineMult: 2, switchTo: null }; }
  (career.impound || (career.impound = {}))[id] = true;
  return { bail: false, strikes: MAX_STRIKES, impounded: true, lastCar: false, fineMult: 1, switchTo: others[others.length - 1] };
}
// Get a car out of the yard (or wipe a free car's strikes). Uses a release paper if you hold one, otherwise cash. Returns { ok, paid, paper, why }.
export function releaseCar(career, id, price) {
  const imp = isImpounded(career, id), n = strikesOf(career, id); if (!imp && n <= 0) return { ok: false, why: "nothing" };
  const tk = career.tokens || (career.tokens = { bail: 0, release: 0 });
  let paid = 0, paper = false;
  if ((tk.release || 0) > 0) { tk.release--; paper = true; }
  else { paid = imp ? releaseFee(price) : Math.round(releaseFee(price) * 0.5 / 100) * 100; if (career.cash < paid) return { ok: false, why: "cash", need: paid }; career.cash -= paid; }
  if (career.impound) delete career.impound[id]; if (career.strikes) career.strikes[id] = 0;
  return { ok: true, paid, paper };
}

// ---------------------------------------------------------------- THE POLICE RADIO ----------------------------------------------------------------
// Short lines the dispatcher and the patrol cars say during a chase. {unit} {heat} {place} {speed} {car} are filled in.
const LINES = {
  start: ["All units, we have a street racer in a {car}. {unit} is in pursuit.", "Dispatch, {unit}: got a runner near {place}. Lighting him up.", "{unit} to dispatch, suspect {car} refusing to stop. Pursuit is on."],
  heat: ["Dispatch to all units: raise it to condition {heat}. I want that {car} stopped.", "Condition {heat}. More units rolling to {place}.", "Be advised, pursuit is now condition {heat}. Supervisors are watching this one."],
  speed: ["{unit}: suspect doing {speed} and climbing!", "Dispatch, he just went past me at {speed}. I can't hold him.", "Clocked at {speed}. Add excessive speeding to the sheet."],
  ram: ["{unit}: he hit me! Suspect is ramming units!", "Officer struck! Add assault on a police vehicle.", "Dispatch, I took a hit. Still in pursuit."],
  wreck: ["{unit} is out, {unit} is out! Vehicle disabled.", "Dispatch, we just lost a unit. Send a tow to {place}.", "Unit down. He's wrecking us out here."],
  traffic: ["Suspect just hit a civilian vehicle. Add hit and run.", "Dispatch, we have a collision with traffic near {place}.", "He's driving through traffic like it isn't there."],
  block: ["Roadblock is set ahead. Box him in.", "All units, block in position. Do not let him through.", "{unit}: roadblock ready near {place}."],
  blockRun: ["He went over the roadblock! Over it!", "Dispatch, the block failed. Suspect is through.", "I don't believe it. He jumped the block."],
  spikes: ["Spike strips are down. Hold your lanes.", "{unit}: strips deployed ahead of the suspect.", "Spikes out near {place}. Stay clear, units."],
  heli: ["Air unit overhead. I have eyes on the {car}.", "Air support to ground: he can't hide from up here.", "This is air one. Suspect {car} in sight."],
  breaker: ["He just brought a structure down on our units!", "Dispatch, debris on the road, units trapped.", "Add destruction of city property. A lot of it."],
  lost: ["{unit}: I've lost visual. Anybody got him?", "Dispatch, suspect is out of sight. Search the area around {place}.", "No visual. Check the side streets."],
  found: ["There he is! {unit} back in pursuit.", "Visual regained. Suspect {car} heading out of {place}.", "Got him again. Don't lose him this time."],
  bust: ["Suspect in custody. Good work, all units.", "{unit}: we got him. Driver is out of the car.", "Dispatch, pursuit ended. One in custody, tow the {car}."],
  impound: ["That's three strikes on this {car}. It goes to the yard.", "Dispatch, vehicle seized. Impound it.", "Tow truck to {place}. This {car} is done."],
  escape: ["All units, suspect is gone. Stand down.", "Dispatch: we lost him. Put the {car} on the board.", "Pursuit ended, no arrest. Write it up."],
};
export const RADIO_KINDS = Object.keys(LINES);
const UNITS = ["Unit 12", "Unit 27", "Unit 31", "Unit 44", "Unit 58", "Unit 63", "Car 7", "Car 19", "Patrol 9", "Patrol 22"];
export function radioLine(kind, ctx, rnd, last) {
  const set = LINES[kind]; if (!set) return "";
  let s = set[Math.floor(rnd() * set.length) % set.length]; if (s === last && set.length > 1) s = set[(set.indexOf(s) + 1) % set.length];
  const unit = UNITS[Math.floor(rnd() * UNITS.length) % UNITS.length];
  return s.replace(/\{unit\}/g, unit).replace(/\{heat\}/g, String(ctx.heat || 1)).replace(/\{place\}/g, ctx.place || "the district").replace(/\{speed\}/g, `${Math.round((ctx.speed || 0) / 10) * 10} km/h`).replace(/\{car\}/g, ctx.car || "car");
}
// how long a line of a kind must wait after the last line, so the radio never talks over itself ("bust", "escape", "impound" always go through)
export const RADIO_GAP = { start: 0, heat: 2, speed: 14, ram: 9, wreck: 5, traffic: 10, block: 8, blockRun: 3, spikes: 10, heli: 6, breaker: 4, lost: 8, found: 6, bust: 0, impound: 0, escape: 0 };
