// Midnight Burn — STORY MODE: "THE LAST GHOST" (Upgrades 61–62).
//
// Ten years ago the city's unbeaten street racer, known only as Ghost, vanished on the night of the Last Run. No crash, no body,
// no car. Tonight that car is sitting in your garage, engine warm, its dashcam card shredded. Every chapter rebuilds a piece of
// the footage, and every racer who was there that night tells a different version of what happened.
//
// This file is the story itself (six chapters, written for both cities) and the director that plays it on top of the normal game:
// cinematic dialogue over the live city (spoken aloud by storyVoice.js), dashcam "found footage" drives, memory scenes, and
// missions: drive somewhere (sometimes against the clock), resync a stretch of Ghost's route against Ghost's own line, race a crew,
// tail a car without being seen, escape a car hunting you, and drift trials. It drives the sim (sim.js) and the camera (render.js
// debugCam) the same way the intro film does; the words on screen are drawn by MidnightBurnStory.js.
import { IS_TOKYO } from "./mapId";
import { DISTRICTS } from "./geo";

// ---- who speaks ----------------------------------------------------------------------------------------------------------------------------
export const CAST = {
  you: { name: "SPANNER", role: "YOU", color: "#ffb347" },
  unknown: { name: "UNKNOWN CALLER", role: "PHONE", color: "#a7b0c4", phone: true },
  static: { name: "STATIC", role: "RADIO", color: "#2de2ff" },
  staticLive: { name: "STATIC", role: "", color: "#2de2ff" },
  ghost: { name: "GHOST", role: "DASHCAM · 2036", color: "#f4f4f4", tape: true },
  ghostLive: { name: "GHOST", role: "", color: "#f4f4f4" },
  nav: { name: "NAVIGATOR", role: "DASHCAM · 2036", color: "#8fe9ff", tape: true },
  saffron: { name: "SAFFRON", role: "RADIO · 2036", color: "#ff8a1f", tape: true },
  saffronLive: { name: "SAFFRON", role: "", color: "#ff8a1f" },
  lantern: { name: "LANTERN", role: "", color: "#ffd23a" },
  hammer: { name: "HAMMER", role: "", color: "#ff5a1f" },
  hammerTape: { name: "HAMMER", role: "RADIO · 2036", color: "#ff5a1f", tape: true },
  collector: { name: "THE COLLECTOR", role: "", color: "#c9a2ff" },
  collectorTape: { name: "THE COLLECTOR", role: "RADIO · 2036", color: "#c9a2ff", tape: true },
  collectorPhone: { name: "THE COLLECTOR", role: "PHONE", color: "#c9a2ff", phone: true },
};
// which voice each speaker uses (storyVoice.js knows the voices by these names)
export const VOICE_OF = { staticLive: "static", ghostLive: "ghost", saffronLive: "saffron", hammerTape: "hammer", collectorTape: "collector", collectorPhone: "collector" };

// ---- the words and places that change between the two cities ----------------------------------------------------------------------------
const W = IS_TOKYO
  ? {
      city: "TOKYO", bridge: "the Rainbow Bridge", garage: "Ginza", staticArea: "Akihabara", staticSpot: "the repair shop under the Akihabara tracks",
      lanternArea: "Toyosu", resyncEnd: "Shiodome", tailEnd: "the empty warehouses on Odaiba", hammerArea: "the Kawasaki docks", hammerYard: "the Keihin refinery yard",
      saffronArea: "Roppongi", collectorArea: "the old red-brick warehouses in Yokohama", crossing: "the bay", safe: "Ueno",
      places: {
        home: "shop:home", static: "akihabara", resync: ["akihabara", "shiodome"], tail: ["shiodome", "odaiba"], dashRoadA: ["rainbow", 0.18], dashRoadB: ["r4", 0.3],
        lantern: "toyosu", c2race: ["toyosu", "odaiba", "shiodome"], c2escape: ["toyosu", "ueno"], c2dashA: ["wangan", 0.42], c2dashB: ["c1", 0.3],
        hammer: "kawasaki", hammerFrom: "hnd", drift3: "keihin", c3tail: ["kawasaki", "redbrick"], c3race: ["daikokupa", "baybridge", "kannai"], c3dashA: ["k5", 0.5], c3dashB: ["baybridge", 0.4],
        saffron: "roppongi", c4race: ["roppongi", "shibuyax", "shinjuku"], c4resync: ["shibuyax", "nakano"], c4dashA: ["r3", 0.35], c4dashB: ["c1", 0.62],
        collector: "redbrick", c5from: "shop:home", c5escape: ["redbrick", "kawasaki"], c5dashA: ["wangan", 0.6], c5dashB: ["rainbow", 0.4],
        c6race: ["shiodome", "rainbow", "odaiba"], c6dashA: ["rainbow", 0.25], c6dashB: ["rainbow", 0.5], c6dashC: ["wangan", 0.3],
      },
    }
  : {
      city: "MUMBAI", bridge: "the Sea Link", garage: "Marine Drive", staticArea: "Dharavi", staticSpot: "the old print works in Dharavi",
      lanternArea: "Sewri", resyncEnd: "Worli", tailEnd: "the Sewri dock gates", hammerArea: "the JNPT container port", hammerYard: "the JNPT container yard",
      saffronArea: "Bandra Kurla", collectorArea: "the old salt pans at Uran", crossing: "the harbour", safe: "Colaba",
      places: {
        home: "marinedrive", static: "dharavi", resync: ["dharavi", "worli"], tail: ["worli", "sewri"], dashRoadA: ["weh", "sealink"], dashRoadB: ["weh", 0.22],
        lantern: "sewri", c2race: ["sewri", "dadar", "worli"], c2escape: ["sewri", "cst", "colaba"], c2dashA: ["eeh", 0.4], c2dashB: ["weh", 0.55],
        hammer: "jnpt", hammerFrom: "nerul", drift3: "jnpt", c3tail: ["jnpt", "uran"], c3race: ["uran", "belapur"], c3dashA: ["atal", 0.5], c3dashB: ["eeh", 0.7],
        saffron: "bkc", c4race: ["bkc", "kurla", "powai"], c4resync: ["bandra", "juhu"], c4dashA: ["weh", 0.6], c4dashB: ["weh", 0.75],
        collector: "uran", c5from: "sewri", c5escape: ["uran", "belapur", "vashi"], c5dashA: ["atal", 0.3], c5dashB: ["weh", 0.8],
        c6race: ["juhu", "sealink", "worli"], c6dashA: ["weh", "sealink"], c6dashB: ["weh", 0.82], c6dashC: ["eeh", 0.5],
      },
    };

export const FOOTAGE_TOTAL = 12;
export const CHAPTERS = [
  { n: 1, title: "THE CAR THAT CAME BACK", ready: true },
  { n: 2, title: "LANTERN'S VERSION", ready: true },
  { n: 3, title: "HAMMER'S VERSION", ready: true },
  { n: 4, title: "SAFFRON'S VERSION", ready: true },
  { n: 5, title: "THE COLLECTOR", ready: true },
  { n: 6, title: "THE LAST RUN", ready: true },
];
export const STORY_TAG = "A legend vanished ten years ago. No crash, no body, no car. Tonight the car is in your garage.";

// scene kinds:
//   card   title words on black            dash   dashcam footage: the car drives itself, a 2036 timestamp runs, voices from that night
//   talk   a conversation, slow camera      goto   drive to a place (time: seconds, or "auto" = a fair limit worked out from the distance)
//   race   race named drivers on a route (cast: one driver or a list)   tail   follow a car: not too close, not too far
//   escape lose the cars chasing you: open up `gap` metres, or reach the end first      drift  score a drift total inside a ring
//   end    chapter complete
// cp = a checkpoint the save resumes from; grade = a memory scene's colour look and label; tod = time of day (default night).
const ghostLine = (n, base) => ({ id: "story_ghost" + n, name: "GHOST · 2036", color: "#e8e8ee", car: "specter", ai: { base, latG: 0.86, nos: true } });
const resyncText = (n) => [["FRAMES RECOVERED", `Segment ${String(n).padStart(2, "0")} rebuilt from the drive log.`], ["RESYNC FAILED", "Ghost's line got away. The frames are still noise."]];

// ---- CHAPTER 1: THE CAR THAT CAME BACK ------------------------------------------------------------------------------------------------------
function chapter1() {
  const P = W.places;
  return [
    { kind: "dash", cp: true, road: P.dashRoadA, speed: 34, secs: 21, clock: [2036, 3, 14, 3, 11, 2], rain: 0.8, flash: true,
      lines: [
        [0.8, "nav", `${IS_TOKYO ? "Bridge" : "Sea Link"} in four hundred. Saffron's still on our tail.`],
        [4.6, "ghost", "Let her. Nobody passes on the bridge."],
        [8.2, "saffron", "Ghost! Pull over. This isn't a race any more."],
        [11.8, "nav", "There's something on the bridge. Lights. A lot of lights."],
        [15.4, "ghost", "Hold on to something, kid."],
        [18.6, "ghost", "If anyone ever finds this... finish it."],
      ] },
    { kind: "card", secs: 5.5, kicker: "TAP & SCORE PRESENTS", big: "THE LAST GHOST", sub: "A MIDNIGHT BURN STORY", say: "The Last Ghost." },
    { kind: "card", secs: 4.5, kicker: `${W.city} · 2046`, big: "TEN YEARS LATER", sub: "CHAPTER 1 · THE CAR THAT CAME BACK", say: "Chapter one. The car that came back." },
    { kind: "talk", cp: true, at: P.home, cam: "orbit", place: `YOUR GARAGE · ${W.garage.toUpperCase()} · 11:48 PM`,
      lines: [
        ["you", "The shutter was locked. The alarm never went off. And there's a car in my bay."],
        ["you", "No plates. No chassis number. Engine's still warm."],
        ["you", "...That's not possible. That's the Wraith."],
        ["unknown", "Don't open the bonnet. Not yet."],
        ["you", "Who is this? How did you get this number?"],
        ["unknown", "Someone who needs that car driven. The dashcam has a memory card. Most of it is destroyed."],
        ["unknown", `There's someone who can fix that. She calls herself Static. ${W.staticSpot}. Go now.`],
        ["unknown", "And Spanner? Don't let anyone see that car in daylight."],
        ["you", "How do you know my name? ...Hello?"],
      ] },
    { kind: "goto", cp: true, to: P.static, text: `Drive to Static's workshop in ${W.staticArea}`, radius: 55,
      radio: [
        [0.45, "unknown", "You drive like your father did. Smooth hands. Late brakes."],
        [0.62, "you", "You knew my father? ...Hey. Hey!"],
      ] },
    { kind: "talk", cp: true, at: P.static, cam: "low", place: `${W.staticArea.toUpperCase()} · 12:21 AM`,
      lines: [
        ["staticLive", "Nice car. Shame it's impossible."],
        ["staticLive", `That's the Wraith. Ghost's car. It went off ${W.bridge} ten years ago. Everybody knows that.`],
        ["you", "Everybody's wrong. It drove here."],
        ["staticLive", "...Okay. Let me look at the card."],
        ["staticLive", "It's shredded. Ninety percent noise. But the car kept a drive log: every turn of the wheel, every brake, from the last night Ghost drove it."],
        ["staticLive", "If you drive the same roads the same way, I can rebuild the frames from the log. Match Ghost's line, and the footage comes back."],
        ["you", "So I race a dead driver's ghost."],
        ["staticLive", `Nobody said dead. First stretch runs ${W.staticArea} to ${W.resyncEnd}. Ghost's line is on your screen. Beat it, or lose the frames.`],
      ] },
    { kind: "race", cp: true, key: "resync1", route: P.resync, title: "RESYNC 01", text: `Beat Ghost's 2036 line to ${W.resyncEnd}`, cast: ghostLine(1, 0.9), win: resyncText(1)[0], lose: resyncText(1)[1] },
    { kind: "dash", cp: true, road: P.dashRoadB, speed: 28, secs: 19, clock: [2036, 3, 14, 2, 58, 40], rain: 0.3, footage: "seg01", label: "SEGMENT 01 · RECOVERED",
      lines: [
        [0.6, "ghost", "How many came tonight?"],
        [3.4, "nav", "Four. Saffron, Hammer, Lantern... and a black car I don't know. No plates."],
        [8.2, "ghost", "Then it's not a race. Somebody paid for a show."],
        [11.6, "nav", "We can still turn back."],
        [14.2, "ghost", "If I turn back, they come for the garage. They come for Spanner's dad."],
      ] },
    { kind: "talk", cp: true, cam: "orbit", place: "RADIO · STATIC",
      lines: [
        ["static", "Spanner... that voice. The navigator. That's me. I was fourteen."],
        ["you", "You were in the car?"],
        ["static", "I woke up three days later in a hospital bed. No car. No Ghost. Nobody would tell me anything."],
        ["you", "Ghost said my dad's name. He fixed cars. He never raced. He never talked about any of this."],
        ["static", "Then this isn't just my story. It's yours too."],
        ["static", `Four cars chased Ghost that night. One of them still races. Lantern. She runs a tuning bay in ${W.lanternArea} now.`],
        ["static", "And Spanner... that black car with no plates? It's behind you. It's been behind you since my workshop."],
        ["you", "Then let's see where it goes. Quietly."],
      ] },
    { kind: "tail", cp: true, key: "tail1", route: P.tail, title: "THE BLACK CAR", text: "Follow the black car. Don't let it see you.",
      cast: { id: "story_watcher", name: "NO PLATES", color: "#0d0e12", car: "razor", ai: { base: 0.74, latG: 0.76, nos: false } }, near: 24, far: 210, lead: 70,
      win: ["TRAIL HELD", "The black car never saw you."], lose: ["YOU WERE SEEN", "The black car is gone. Try again."], lost: ["YOU LOST IT", "The black car got away. Try again."] },
    { kind: "talk", cp: true, cam: "high", place: W.tailEnd.toUpperCase(),
      lines: [
        ["you", `It stopped at ${W.tailEnd}. The driver didn't get out.`],
        ["unknown", "Don't go in there."],
        ["you", "Then tell me who you are."],
        ["unknown", `Someone who was on ${W.bridge} that night.`],
        ["unknown", "Someone who never really left it."],
        ["static", `Spanner, Lantern's bay is two streets from you. Whatever's behind that gate... she'll know. She was there.`],
        ["you", "Then Lantern's next."],
      ] },
    { kind: "end", big: "END OF CHAPTER 1", sub: "NEXT · CHAPTER 2 · LANTERN'S VERSION", note: "Every racer remembers that night differently." },
  ];
}

// ---- CHAPTER 2: LANTERN'S VERSION -------------------------------------------------------------------------------------------------------------
// Lantern tells you Ghost crashed in the rain. You race her version of that night (her memory, in her colours), the footage says
// otherwise, and the black car comes back for you.
function chapter2() {
  const P = W.places, mem = { tint: "amber", label: "LANTERN'S VERSION · 14.03.2036" };
  return [
    { kind: "card", secs: 4.5, kicker: `${W.city} · 1:40 AM`, big: "LANTERN'S VERSION", sub: "CHAPTER 2", say: "Chapter two. Lantern's version." },
    { kind: "talk", cp: true, at: P.lantern, cam: "low", place: `LANTERN'S TUNING BAY · ${W.lanternArea.toUpperCase()}`,
      lines: [
        ["lantern", "We're closed. Take your... oh. Oh, no. Where did you get that car?"],
        ["you", "It found me. You were on the bridge the night it disappeared."],
        ["lantern", "Everybody was on the bridge. Everybody's got a story about it."],
        ["you", "I want yours."],
        ["lantern", "Mine's simple. It was pouring. Ghost was showing off, took the bridge flat out, lost the back end and went into the water. End of legend."],
        ["staticLive", "Funny. The drive log says the road was dry."],
        ["lantern", "Then your log's broken. I was right behind Ghost. I saw it."],
        ["you", "Then show me. Race me your way. Your line, your rain, the way you remember it."],
        ["lantern", "...Fine. One run. And when you lose, you take that thing far away from my bay."],
      ] },
    { kind: "race", cp: true, key: "c2race", route: P.c2race, title: "LANTERN'S VERSION", text: "Race Lantern through the night she remembers", rain: 0.85, grade: mem,
      cast: { id: "story_lantern", name: "LANTERN", color: "#ffd23a", car: "praga", ai: { base: 0.9, latG: 0.86, nos: true } },
      win: ["YOU WON HER RACE", "But her version doesn't add up."], lose: ["LANTERN WINS", "Her memory, her rules. Try again."] },
    { kind: "talk", cp: true, cam: "orbit", place: `${W.lanternArea.toUpperCase()} · 2:05 AM`,
      lines: [
        ["lantern", "You drive like... no. That's not possible either."],
        ["staticLive", "The race filled two more blocks of the drive log. Spanner, it's rebuilding. Give me a minute."],
        ["you", "Lantern. One more time. Was it raining?"],
        ["lantern", "...No. It wasn't raining. I tell people it was. It's easier than the truth."],
        ["lantern", "There were trucks on the bridge. Four of them, parked across every lane, lights on full. Somebody wanted Ghost to hit them."],
        ["you", "Who moved the trucks?"],
        ["lantern", `Hammer's crew. ${W.hammerArea}. He drove one himself. I never told anyone. I have a daughter.`],
      ] },
    { kind: "dash", cp: true, road: P.c2dashA, speed: 30, secs: 18, clock: [2036, 3, 14, 3, 4, 12], rain: 0, footage: "seg02", label: "SEGMENT 02 · RECOVERED",
      lines: [
        [0.6, "nav", "Road's dry. Lantern's falling back. Hammer's crew just left the convoy."],
        [4.8, "ghost", "Left it for where?"],
        [7.6, "nav", "Towards the bridge. Fast. Ghost, they're getting ahead of us."],
        [11.2, "ghost", "Nobody gets ahead of us on that bridge. Unless they're not racing."],
      ] },
    { kind: "dash", road: P.c2dashB, speed: 33, secs: 15, clock: [2036, 3, 14, 3, 8, 50], rain: 0, footage: "seg03", label: "SEGMENT 03 · RECOVERED",
      lines: [
        [0.5, "hammerTape", "Trucks are in. All four lanes. Lights on your word."],
        [4.2, "collectorTape", "Not yet. Let Ghost see them late."],
        [8.0, "nav", "Who was that? That's not one of the racers."],
        [10.6, "ghost", "That's the one who paid for tonight."],
      ] },
    { kind: "talk", cp: true, cam: "high", place: "RADIO · STATIC",
      lines: [
        ["static", "Spanner. That second voice on the radio. I've heard it before... I just don't know where."],
        ["static", "And bad news. The black car is outside Lantern's bay. Three more just pulled up behind it."],
        ["lantern", "They followed you here. Get out. Go! Lose them before they see where you sleep."],
      ] },
    { kind: "escape", cp: true, key: "c2escape", route: P.c2escape, title: "SHAKE THEM OFF", text: "Lose the black car. Get 500 m clear, or reach the end first.", gap: 500, lead: 40,
      cast: [{ id: "story_bc1", name: "NO PLATES", color: "#0d0e12", car: "razor", ai: { base: 1.0, latG: 0.92, nos: true } }],
      win: ["CLEAN GETAWAY", "The black car lost you."], lose: ["CAUGHT", "They boxed you in. Try again."] },
    { kind: "talk", cp: true, cam: "orbit", place: `${W.safe.toUpperCase()} · 2:40 AM`,
      lines: [
        ["you", "They're gone. For now."],
        ["unknown", "You did well. Lantern told you the truth, in the end. Most people never do."],
        ["you", "You knew about the trucks. You knew all along."],
        ["unknown", `I knew. What I need is proof. Hammer has it. Go to ${W.hammerArea}. Don't go alone.`],
        ["static", "He won't be alone. I'm coming with him."],
      ] },
    { kind: "end", big: "END OF CHAPTER 2", sub: "NEXT · CHAPTER 3 · HAMMER'S VERSION", note: "Four trucks. One voice on the radio. Somebody paid for that night." },
  ];
}

// ---- CHAPTER 3: HAMMER'S VERSION ------------------------------------------------------------------------------------------------------------
function chapter3() {
  const P = W.places, mem = { tint: "blue", label: "HAMMER'S VERSION · 14.03.2036" };
  return [
    { kind: "card", secs: 4.5, kicker: `${W.city} · 3:15 AM`, big: "HAMMER'S VERSION", sub: "CHAPTER 3", say: "Chapter three. Hammer's version." },
    { kind: "goto", cp: true, from: P.hammerFrom, to: P.hammer, text: `Drive to ${W.hammerArea}`, radius: 70,
      radio: [
        [0.15, "static", "Hammer runs the night shift at the port. Forty crews, one boss. He doesn't talk to strangers."],
        [0.4, "you", "Then I won't be a stranger for long."],
        [0.65, "static", "He trusts one thing: how you drive. Whatever he asks you to do, do it better than his people."],
      ] },
    { kind: "talk", cp: true, at: P.hammer, cam: "high", place: W.hammerYard.toUpperCase(),
      lines: [
        ["hammer", "Nice car. I sank one just like it once. Into a harbour. Long story."],
        ["you", "I know the story. You parked trucks across a bridge."],
        ["hammer", "Careful. People who say that around here end up working the night shift for free."],
        ["staticLive", "We're not police. We just want to know who was on the radio."],
        ["hammer", "Everybody wants something. Here's what I want: my yard, my rules. Slide through it like you mean it and I'll talk."],
      ] },
    { kind: "drift", cp: true, key: "drift3", at: P.drift3, radius: 300, time: 75, goals: [6000, 12000, 20000], need: 6000, title: "HAMMER'S YARD", text: "Drift inside the yard: score 6,000 before time runs out",
      win: ["HAMMER IS IMPRESSED", "Not bad, for a ghost."], lose: ["NOT ENOUGH", "Hammer has seen better from forklifts. Try again."] },
    { kind: "talk", cp: true, cam: "low", place: W.hammerYard.toUpperCase(), grade: mem,
      lines: [
        ["hammer", "Fine. My version. I was paid to park four trucks. That's all. Nobody said anyone would get hurt."],
        ["hammer", "Big money. Cash, in a car with no plates. And a voice on the radio telling us when to switch on the lights."],
        ["you", "Whose voice?"],
        ["hammer", "Never saw a face. People called him the Collector. He collects things. Cars. Debts. People."],
        ["hammer", "He paid Saffron too. More than me. She was the one who boxed Ghost in."],
        ["hammer", "And one of his trucks is leaving my yard right now. Want to see where he keeps his toys? Follow it. Quietly."],
      ] },
    { kind: "tail", cp: true, key: "c3tail", route: P.c3tail, title: "THE COLLECTOR'S TRUCK", text: "Follow the truck to the Collector. Don't get close.",
      cast: { id: "story_truck", name: "HAULER", color: "#ff7a1a", car: "brute", ai: { base: 0.72, latG: 0.72, nos: false } }, near: 26, far: 230, lead: 75,
      win: ["FOUND IT", `The truck stopped at ${W.collectorArea}.`], lose: ["SPOTTED", "The driver saw you. Try again."], lost: ["LOST IT", "The truck got away. Try again."] },
    { kind: "talk", cp: true, cam: "high", place: W.collectorArea.toUpperCase(),
      lines: [
        ["staticLive", "Spanner, look at the gate. That's the black car. And behind it... there must be thirty cars in there."],
        ["you", "His collection."],
        ["staticLive", "The log has one more stretch close by. Ghost drove it that night, before the bridge. If we sync it now, we get the voice clean."],
      ] },
    { kind: "race", cp: true, key: "resync2", route: P.c3race, title: "RESYNC 02", text: "Beat Ghost's 2036 line", cast: ghostLine(2, 0.92), win: resyncText(4)[0], lose: resyncText(4)[1] },
    { kind: "dash", cp: true, road: P.c3dashA, speed: 30, secs: 17, clock: [2036, 3, 14, 2, 41, 7], rain: 0.1, footage: "seg04", label: "SEGMENT 04 · RECOVERED",
      lines: [
        [0.5, "ghost", "Kid. If anything happens tonight, you go to the garage. Spanner's dad will know what to do."],
        [6.5, "nav", "Nothing's going to happen. You never lose."],
        [10.0, "ghost", "That's what worries me. Somebody needs me to lose tonight."],
      ] },
    { kind: "dash", road: P.c3dashB, speed: 33, secs: 15, clock: [2036, 3, 14, 3, 10, 30], rain: 0, footage: "seg05", label: "SEGMENT 05 · RECOVERED",
      lines: [
        [0.5, "collectorTape", "Saffron. Close the inside lane. Hammer, lights in ten."],
        [5.0, "saffron", "I didn't sign up for this."],
        [8.0, "collectorTape", "You signed the moment you took my money. Close the lane."],
      ] },
    { kind: "talk", cp: true, cam: "orbit", place: "RADIO · STATIC",
      lines: [
        ["static", "That's him. The Collector. Clean voice, no static. That's proof, Spanner."],
        ["you", "It proves he gave the orders. It doesn't prove what happened to Ghost."],
        ["unknown", `Saffron knows the rest. She's in ${W.saffronArea} now. Rich, protected, careful.`],
        ["unknown", "She'll lie to you. Let her. Then show her the footage."],
      ] },
    { kind: "end", big: "END OF CHAPTER 3", sub: "NEXT · CHAPTER 4 · SAFFRON'S VERSION", note: "The Collector gave the orders. Saffron closed the lane." },
  ];
}

// ---- CHAPTER 4: SAFFRON'S VERSION ------------------------------------------------------------------------------------------------------------
function chapter4() {
  const P = W.places, mem = { tint: "red", label: "SAFFRON'S VERSION · 14.03.2036" };
  return [
    { kind: "card", secs: 4.5, kicker: `${W.city} · 11:10 PM · THE NEXT NIGHT`, big: "SAFFRON'S VERSION", sub: "CHAPTER 4", say: "Chapter four. Saffron's version." },
    { kind: "talk", cp: true, at: P.saffron, cam: "low", place: `${W.saffronArea.toUpperCase()} · SAFFRON'S CREW`,
      lines: [
        ["saffronLive", "So you're the one driving a dead legend's car around my city. Bold."],
        ["you", "You were behind Ghost on the bridge. You were paid to close the inside lane."],
        ["saffronLive", "Who told you that? Hammer? Hammer would sell his own engine for petrol money."],
        ["saffronLive", "My version: I tried to stop Ghost. I was screaming on the radio to pull over. Ghost wouldn't listen."],
        ["staticLive", "That part's true. We have it on tape."],
        ["saffronLive", "Then we're done. Unless you want to race my crew for the rest of the story. Three of my best. You win, you get your answers."],
      ] },
    { kind: "race", cp: true, key: "c4race", route: P.c4race, title: "SAFFRON'S CREW", text: "Beat Saffron's crew to the finish",
      cast: [
        { id: "story_saf1", name: "SAFFRON", color: "#ff8a1f", car: "vesper", ai: { base: 0.92, latG: 0.88, nos: true } },
        { id: "story_saf2", name: "EMBER", color: "#ff4d2e", car: "solo", ai: { base: 0.88, latG: 0.84, nos: true } },
        { id: "story_saf3", name: "CINDER", color: "#d8a020", car: "frame", ai: { base: 0.86, latG: 0.82, nos: true } },
      ],
      win: ["CREW BEATEN", "Saffron owes you the truth."], lose: ["SAFFRON WINS", "Her crew, her city. Try again."] },
    { kind: "talk", cp: true, cam: "orbit", place: W.saffronArea.toUpperCase(),
      lines: [
        ["saffronLive", "...Okay. You can drive. Ghost could drive like that."],
        ["saffronLive", "Here's what I never told anyone. I closed the lane. I did. And then I opened it again."],
        ["saffronLive", "When the trucks lit up I saw what he wanted. Not a lost race. A crash. So I pulled back and left Ghost a gap."],
        ["you", "A gap to where?"],
        ["saffronLive", "The service ramp. There's a maintenance ramp off the bridge, down to the water level. Ghost took it in the dark. Lights off."],
        ["staticLive", "Then Ghost never went into the water."],
        ["saffronLive", "Ghost went somewhere. Nobody ever saw that car again. Until you."],
      ] },
    { kind: "race", cp: true, key: "resync3", route: P.c4resync, title: "RESYNC 03", text: "Beat Ghost's 2036 line", cast: ghostLine(3, 0.94), grade: mem, win: resyncText(6)[0], lose: resyncText(6)[1] },
    { kind: "dash", cp: true, road: P.c4dashA, speed: 32, secs: 18, clock: [2036, 3, 14, 3, 11, 40], rain: 0, footage: "seg06", label: "SEGMENT 06 · RECOVERED",
      lines: [
        [0.5, "nav", "Trucks! All four lanes!"],
        [2.6, "saffron", "Ghost! Inside! I'm giving you the inside!"],
        [6.0, "ghost", "Lights off. Hold on."],
        [9.0, "nav", "We're going to hit the... we're going down? Where are we going?"],
        [12.6, "ghost", "Somewhere he can't follow."],
      ] },
    { kind: "dash", road: P.c4dashB, speed: 22, secs: 16, clock: [2036, 3, 14, 3, 13, 5], rain: 0, footage: "seg07", label: "SEGMENT 07 · RECOVERED",
      lines: [
        [0.5, "ghost", "Kid? Kid, stay with me. You hit your head. You're okay."],
        [5.2, "ghost", "I'm taking you to the hospital. Then I'm going to disappear for a while."],
        [10.0, "ghost", "If he thinks I'm dead, he stops hunting. Everyone you love stays safe."],
      ] },
    { kind: "talk", cp: true, cam: "high", place: "RADIO · STATIC",
      lines: [
        ["static", "Ghost carried me in. Ghost saved my life and then let the whole city think they were dead. For me."],
        ["collectorPhone", "Touching. Really. I've been listening to your little radio for two nights, mechanic."],
        ["collectorPhone", "You have my car. My card. And something of mine you don't know about yet."],
        ["collectorPhone", `Come to ${W.collectorArea}. Alone. Bring the card. Or your friend Static loses everything she owns tonight.`],
      ] },
    { kind: "end", big: "END OF CHAPTER 4", sub: "NEXT · CHAPTER 5 · THE COLLECTOR", note: "Ghost went dark on the bridge. Now the Collector wants the card." },
  ];
}

// ---- CHAPTER 5: THE COLLECTOR ------------------------------------------------------------------------------------------------------------------
function chapter5() {
  const P = W.places;
  return [
    { kind: "card", secs: 4.5, kicker: `${W.city} · 1:00 AM`, big: "THE COLLECTOR", sub: "CHAPTER 5", say: "Chapter five. The Collector." },
    { kind: "talk", cp: true, at: P.collector, cam: "high", place: W.collectorArea.toUpperCase(),
      lines: [
        ["collector", "There it is. My car. Built by your father, driven by a thief, and finally home."],
        ["you", "It was never yours."],
        ["collector", "I paid for your father's workshop, mechanic. I paid for that engine. Ghost won races on my money and then refused to lose one."],
        ["collector", "Everything in this city has a price. Ghost's was the bridge. Yours is the card."],
        ["you", "And if I don't give it to you?"],
        ["collector", "Then you'll find out why they call it a collection. Gentlemen... take the car."],
      ] },
    { kind: "escape", cp: true, key: "c5escape", route: P.c5escape, title: "THE COLLECTION", text: "Escape the Collector's drivers. Get 600 m clear, or reach the end first.", gap: 600, lead: 35,
      cast: [
        { id: "story_col1", name: "COLLECTOR · 1", color: "#5a3a8c", car: "meteor", ai: { base: 1.0, latG: 0.94, nos: true } },
        { id: "story_col2", name: "COLLECTOR · 2", color: "#3a2a5c", car: "razor", ai: { base: 0.98, latG: 0.92, nos: true } },
      ],
      win: ["YOU GOT AWAY", "The Collector's drivers are behind you, somewhere."], lose: ["BOXED IN", "His drivers caught you. Try again."] },
    { kind: "talk", cp: true, at: P.c5from, cam: "orbit", place: "PHONE · BACK ON THE CITY SIDE",
      lines: [
        ["unknown", "Listen to me. He's sending people to Static's workshop. Right now."],
        ["you", "Then I'm going there."],
        ["unknown", "You won't beat them on the main roads. You'll have to drive like Ghost. Go."],
      ] },
    { kind: "goto", cp: true, to: P.static, text: `Reach Static in ${W.staticArea} before the Collector's people`, radius: 60, time: "auto", pace: 21,
      lose: ["TOO LATE", "They got there first. Try again."],
      radio: [
        [0.2, "static", "Spanner, there are cars outside. Three of them. Where are you?"],
        [0.5, "you", "Close. Lock everything. Pull the drives."],
        [0.8, "static", "They're at the door. Hurry!"],
      ] },
    { kind: "talk", cp: true, at: P.static, cam: "low", place: `${W.staticArea.toUpperCase()} · 1:52 AM`,
      lines: [
        ["staticLive", "You came. They saw your lights and ran. Spanner... they didn't run from you."],
        ["you", "Then who did they run from?"],
        ["ghostLive", "From me."],
        ["staticLive", "...That voice."],
        ["ghostLive", "Hello, kid. You got taller."],
      ] },
    { kind: "dash", cp: true, road: P.c5dashA, speed: 26, secs: 16, clock: [2036, 3, 14, 4, 2, 11], rain: 0.2, footage: "seg08", label: "SEGMENT 08 · RECOVERED",
      lines: [
        [0.5, "ghost", "Old friend. I need you to hide the car. Somewhere nobody will ever look."],
        [5.5, "ghost", "Not even your kid. Especially not your kid. If he ever asks, I'm dead."],
        [10.5, "ghost", "One day this card will matter. Keep it with the car."],
      ] },
    { kind: "dash", road: P.c5dashB, speed: 30, secs: 14, clock: [2036, 3, 14, 3, 12, 2], rain: 0, footage: "seg09", label: "SEGMENT 09 · RECOVERED",
      lines: [
        [0.5, "collectorTape", "Where did the car go? Find it. Find the mechanic who built it."],
        [5.0, "hammerTape", "There's nothing down there, boss. It's gone. It's in the water."],
        [9.0, "collectorTape", "Then we wait. Everyone surfaces eventually."],
      ] },
    { kind: "talk", cp: true, cam: "orbit", place: `${W.staticArea.toUpperCase()} · 2:20 AM`,
      lines: [
        ["you", "You were the voice on the phone. All this time."],
        ["ghostLive", "Your father hid the car for me. Ten years in a sealed container. He kept his promise. He never told you."],
        ["ghostLive", "When he passed, the Collector bought his workshop. He's been tearing it apart, looking for this car. So I moved it first. To you."],
        ["you", "Why me?"],
        ["ghostLive", "Because the car's log only syncs with the hands that drive it. And yours drive like his. Like mine."],
        ["collectorPhone", `Ghost. I can hear you breathing. Tomorrow, 3:12 a.m., ${W.bridge}. The Last Run, again. Win, and I walk away. Lose, and I collect.`],
        ["ghostLive", "He'll cheat. He always cheats."],
        ["you", "Then we'll be ready."],
      ] },
    { kind: "end", big: "END OF CHAPTER 5", sub: "NEXT · CHAPTER 6 · THE LAST RUN", note: "Ghost is alive. 3:12 a.m. The same bridge. Ten years later." },
  ];
}

// ---- CHAPTER 6: THE LAST RUN ------------------------------------------------------------------------------------------------------------------
function chapter6() {
  const P = W.places;
  return [
    { kind: "card", secs: 5, kicker: `${W.city} · 3:00 AM · 14 MARCH`, big: "THE LAST RUN", sub: "CHAPTER 6", say: "Chapter six. The last run." },
    { kind: "talk", cp: true, at: P.home, cam: "orbit", place: `YOUR GARAGE · ${W.garage.toUpperCase()} · 2:20 AM`,
      lines: [
        ["ghostLive", "He'll put his best drivers on you. And he'll try the bridge again. Trucks, lights, the same trick."],
        ["staticLive", "And this time we're ready. I've rebuilt nine segments. The last three are on that bridge. Drive it, and the card is complete."],
        ["staticLive", "The moment it's complete, it uploads. Every news desk in the city. His voice, his orders, his trucks."],
        ["you", "And Ghost?"],
        ["ghostLive", "Ghost drives with you. On the radio, like the old days. Lantern, Hammer and Saffron are coming too. Nobody's paid this time."],
        ["ghostLive", "One more thing. Your father put a switch under the dash. Kills every light on the car. He called it the Ghost switch."],
        ["you", "Then let's finish it."],
      ] },
    { kind: "race", cp: true, key: "c6race", route: P.c6race, title: "THE LAST RUN", text: `Win the Last Run across ${W.bridge}`,
      cast: [
        { id: "story_champ", name: "THE CHAMPION", color: "#c9a2ff", car: "vesper", ai: { base: 0.97, latG: 0.9, nos: true } },
        { id: "story_col3", name: "COLLECTOR · 1", color: "#5a3a8c", car: "meteor", ai: { base: 0.95, latG: 0.88, nos: true } },
        { id: "story_col4", name: "COLLECTOR · 2", color: "#3a2a5c", car: "razor", ai: { base: 0.93, latG: 0.86, nos: true } },
      ],
      radio: [
        [6, "ghostLive", "Stay off his rear bumper. He brakes early on purpose."],
        [20, "staticLive", "Trucks moving onto the bridge! Same as last time!"],
        [32, "ghostLive", "I've killed your lights from here. Ghost switch. They can't see you now. Take the inside!"],
        [48, "saffronLive", "Inside lane's yours. Ten years late. Go!"],
      ],
      win: ["THE LAST RUN IS YOURS", "Ten years later, Ghost's run is finished."], lose: ["THE COLLECTOR WINS", "Not tonight. Try again."] },
    { kind: "dash", cp: true, road: P.c6dashA, speed: 30, secs: 15, clock: [2036, 3, 14, 3, 11, 50], rain: 0, footage: "seg10", label: "SEGMENT 10 · RECOVERED",
      lines: [
        [0.5, "collectorTape", "Lights. Now."],
        [3.0, "hammerTape", "Lights on. God help us."],
        [6.5, "saffron", "Ghost, the inside! Go!"],
      ] },
    { kind: "dash", road: P.c6dashB, speed: 26, secs: 14, clock: [2036, 3, 14, 3, 12, 31], rain: 0, footage: "seg11", label: "SEGMENT 11 · RECOVERED",
      lines: [
        [0.5, "nav", "We made it. We made it! Ghost, we're alive!"],
        [5.0, "ghost", "We're alive. But the Ghost has to die tonight, kid. It's the only way he lets you go."],
      ] },
    { kind: "dash", road: P.c6dashC, speed: 30, secs: 16, clock: [2046, 3, 14, 3, 14, 0], rain: 0, footage: "seg12", label: "SEGMENT 12 · TONIGHT", flash: false,
      lines: [
        [0.5, "staticLive", "Twelve of twelve. The card is complete. Uploading... now."],
        [5.0, "staticLive", "It's everywhere. Every channel. His voice, his orders, his trucks. It's over."],
        [10.0, "ghostLive", "Ten years. Thank you, Spanner."],
      ] },
    { kind: "talk", cp: true, at: P.home, cam: "high", place: `${W.garage.toUpperCase()} · SUNRISE`, tod: "dusk",
      lines: [
        ["ghostLive", "The Collector's lawyers are already calling it a fake. It won't help him. Hammer and Lantern are talking to the police this morning."],
        ["staticLive", "And Saffron?"],
        ["ghostLive", "Saffron's paying for everyone's breakfast. Her idea."],
        ["you", "What happens to the car?"],
        ["ghostLive", "Your father built it. You finished its last run. It's yours."],
        ["ghostLive", "The city needs a ghost on its roads at night. I'm too old for it. You're not."],
        ["you", "...See you at midnight."],
      ] },
    { kind: "end", final: true, big: "THE LAST GHOST", sub: "THE END", note: "Thank you for playing. The Wraith is yours: the city is waiting after dark." },
  ];
}

const CHAPTER_FNS = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6];
export function storyScenes(ch = 1) { const f = CHAPTER_FNS[Math.max(0, Math.min(CHAPTER_FNS.length - 1, ch - 1))]; return f(); }
export function chapterCount() { return CHAPTER_FNS.length; }

// ---- the director ------------------------------------------------------------------------------------------------------------------------
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const PARK = { throttle: 0, brake: 0, steer: 0, hand: true, nos: false }; // (holding the brake at a standstill would reverse the car)
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Plays the story on a running game. `opts.chapter` picks the chapter (default: where the save left off). `opts.onUi(ui)` receives
 * what to draw (about 20 times a second), `opts.onExit()` is called when the player leaves from an end card, `opts.voice` speaks the
 * lines (storyVoice.js), `opts.sfx` makes the little sounds. Call tick(dt) once per frame (not while paused), input(raw) to get the
 * controls the sim should use this step, and frame() after the sim steps to place the camera.
 */
export function createStory(G, view, opts = {}) {
  const city = G.world.city;
  const S0 = G.career.story && typeof G.career.story === "object" ? G.career.story : {};
  const S = G.career.story = { ch: 1, at: 0, footage: 0, got: {}, cleared: {}, done: false, ...S0 };
  if (!S.cleared || typeof S.cleared !== "object") S.cleared = {};
  if (S0.done && !S0.cleared) S.cleared = { 1: true }; // a save from the one-chapter version
  let ch = opts.chapter || S.ch || 1; if (ch !== S.ch) { S.ch = ch; S.at = 0; }
  let scenes = storyScenes(ch);
  if (S.at >= scenes.length || S.at < 0) S.at = 0;
  const lm = {}; for (const l of G.world.landmarks || []) lm[l.id] = { x: l.rx ?? l.x, z: l.rz ?? l.z };
  const dist = {}; for (const d of DISTRICTS) dist[d.id] = d;
  const where = (id) => {
    if (typeof id === "string" && id.startsWith("shop:")) { const sh = (G.content.shops || []).find((q) => q.id === id.slice(5)); return sh ? [sh.x, sh.z] : null; }
    const a = lm[id] || dist[id]; return a ? [a.rx ?? a.x, a.rz ?? a.z] : null;
  };
  const sfx = opts.sfx || {}, voice = opts.voice || null;
  let idx = -1, sc = null, t = 0, busy = false, alive = true, saved = null, fail = null, uiT = 0, data = {};
  let lineI = 0, lineT = 0, radioMsg = null, wantNext = false;

  const save = () => { try { if (G.hooks.onSave) G.hooks.onSave(G.career); } catch {} };
  function hold() { G.copsOff = true; if (G.heatReset) G.heatReset(); G.racers.length = 0; G.racerT = 1e9; G.racerNear = null; }
  const vId = (who) => VOICE_OF[who] || who;
  function speak(who, text, done) { if (!voice) { if (done) done(); return false; } return voice.say(vId(who), text, done); }
  function hush() { if (voice) voice.stop(); }

  function autopilot(P, throttle) {
    const n = city.nearestRoad(P.x, P.z, 80, null, P.y); let steer = 0;
    if (n) { const r = n.road; const j = Math.min(r.pts.length - 1, n.i + 7); const a = r.pts[n.i], b = r.pts[j]; let yawT = Math.atan2(b.z - a.z, b.x - a.x); if (Math.cos(yawT - P.yaw) < 0) { const j2 = Math.max(0, n.i - 7); const bb = r.pts[j2]; yawT = Math.atan2(bb.z - a.z, bb.x - a.x); } steer = Math.max(-1, Math.min(1, wrapA(yawT - P.yaw) * 2.4)); }
    const tooFast = P.speed > (sc && sc.speed ? sc.speed : 30);
    return { throttle: tooFast ? 0 : throttle, brake: 0, steer, hand: false, nos: false };
  }
  function camSide(P, kind) { // put the slow cinematic camera on the side of the car that is open road, not a wall or a flyover pillar
    const open = (x, z) => { const n = city.nearestRoad(x, z, 12, null, P.y); return n && n.d != null ? n.d < (n.road.width || 10) / 2 + 1.5 && Math.abs((n.y ?? P.y) - P.y) < 2.5 : !!n; };
    let best = 1, bv = -1;
    for (const s of [1, -1]) { let v = 0; for (let k = 0; k < 6; k++) { const a = kind === "low" ? P.yaw + s * (0.75 - k * 0.05) : kind === "high" ? P.yaw + Math.PI + s * (0.5 + k * 0.1) : P.yaw + Math.PI * 0.8 * s + k * 0.12 * s; const r = kind === "high" ? 14 : 6.5; if (open(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r)) v++; } if (v > bv) { bv = v; best = s; } }
    return best;
  }
  function roadIndex(spec) { // [roadId, fraction 0..1 | landmark id near which to start]
    const r = city.roads.find((q) => q.id === spec[0]); if (!r) return null;
    if (typeof spec[1] === "number") return { road: r.id, i: Math.floor(r.pts.length * spec[1]) };
    const p = where(spec[1]); if (!p) return { road: r.id, i: Math.floor(r.pts.length * 0.3) };
    let bk = 0, bd = 1e9; r.pts.forEach((q, k) => { const d = Math.hypot(q.x - p[0], q.z - p[1]); if (d < bd) { bd = d; bk = k; } });
    return { road: r.id, i: Math.max(5, bk - 60) };
  }

  // ---- story events: built once from the script, kept in the game's event table (not shown on the map) -------------------------------
  function storyEvent(s) {
    const id = "story-" + s.key; if (G.eventById[id] && (G.eventById[id].base || G.eventById[id].type === "drift")) return G.eventById[id];
    if (s.kind === "drift") {
      const p = where(s.at); if (!p) return null; const n = city.nearestNode(p[0], p[1], 900); if (!n) return null;
      const ev = { id, type: "drift", story: true, name: s.title, area: "", blurb: s.text, level: 4, x: n.x, z: n.z, y: n.y ?? 0, sx: n.x, sz: n.z, sy: n.y ?? 0, radius: s.radius || 280, time: s.time || 80, goals: s.goals, reward: { cash: 0, xp: 0, pts: 0 } };
      G.eventById[id] = ev; return ev;
    }
    const wp = s.route.map(where); if (wp.some((p) => !p)) return null;
    const cast = Array.isArray(s.cast) ? s.cast : [s.cast];
    const ev = { id, type: "sprint", story: true, name: s.title, area: "", blurb: s.text, level: 4, wp, loop: false, laps: 1, racers: cast.length, ai: { base: 0.86, latG: 0.8 }, reward: { cash: 0, xp: 0, pts: 0 }, cast };
    return G.addStoryEvent ? G.addStoryEvent(ev) : null;
  }
  const mission = (k) => k === "race" || k === "tail" || k === "escape" || k === "drift";

  // ---- entering and leaving scenes -------------------------------------------------------------------------------------------------
  async function enter(i, isRetry) {
    if (!alive) return;
    if (i >= scenes.length) { endChapter(); return; }
    hush();
    idx = i; sc = scenes[i]; t = 0; lineI = 0; lineT = 0; fail = null; data = { retry: !!isRetry }; radioMsg = null; wantNext = false;
    if (sc.cp) { S.ch = ch; S.at = i; save(); }
    if (sc.kind === "end") { S.cleared = { ...S.cleared, [ch]: true }; if (sc.final) S.done = true; if (ch < CHAPTER_FNS.length) { S.ch = ch + 1; S.at = 0; } save(); }
    data.wall = nowMs();
    busy = true; push(true);
    try {
      if (view.setTimeOfDay) view.setTimeOfDay(sc.tod || "night");
      if (sc.rain != null) { G.weather.rain = sc.rain; G.weather.target = sc.rain; G.wet = sc.rain > 0.3; }
      if (sc.kind === "talk" && sc.at) { const p = where(sc.at); if (p && !G.run) { G.teleport(p[0], p[1]); await view.preload(); } }
      if (sc.kind === "talk") { const P = G.player; P.vx = P.vz = 0; P.speed = 0; data.p0 = { x: P.x, y: P.y, z: P.z, yaw: P.yaw }; data.side = camSide(P, sc.cam); }
      if (sc.kind === "card" && sc.say) speak("narr", sc.say);
      if (sc.kind === "dash") {
        saved = saved || G.player; const ri = roadIndex(sc.road);
        if (!ri || !G.placeOnRoad(ri.road, ri.i, sc.speed * 0.8)) { saved = null; next(); return; }
        G.weather.rain = sc.rain || 0; G.weather.target = sc.rain || 0; G.wet = G.weather.rain > 0.3;
        await view.preload(); view.setCameraMode(2); view.cam.snap = true;
        data.li = 0; data.speaking = false; data.gapUntil = 0; data.doneT = 0;
      }
      if (sc.kind === "goto") {
        const p0 = where(sc.to); if (!p0) { next(); return; }
        // the destination is the street corner nearest the place (a district's middle can be a park or a block of buildings)
        const nn = city.nearestNode(p0[0], p0[1], 600); const p = nn ? [nn.x, nn.z] : p0; // (the GPS route ends at this same street corner)
        if (sc.from && !data.retry) { const f = where(sc.from); if (f) { G.teleport(f[0], f[1]); await view.preload(); } }
        if (sc.time && sc.retryPos && data.retry) { G.teleport(sc.retryPos[0], sc.retryPos[1]); await view.preload(); }
        data.to = p; G.setWaypoint(p[0], p[1], sc.text); const P = G.player; data.d0 = Math.max(200, Math.hypot(p[0] - P.x, p[1] - P.z)); data.said = 0;
        if (sc.time) { sc.retryPos = sc.retryPos || [P.x, P.z]; const navLen = G.nav && G.nav.line && G.nav.line.length > 1 ? G.nav.line.reduce((a, q, k, L) => a + (k ? Math.hypot(q.x - L[k - 1].x, q.z - L[k - 1].z) : 0), 0) : data.d0 * 1.35; data.limit = sc.time === "auto" ? Math.round(navLen / (sc.pace || 22) + 25) : sc.time; data.left = data.limit; }
      }
      if (mission(sc.kind)) {
        const ev = storyEvent(sc); if (!ev) { console.error("story: no route for", sc.key); next(); return; }
        if (G.run) G.abortEvent(true);
        if (!G.startEvent(ev.id, { force: true })) { next(); return; }
        if (sc.kind === "tail") placeTarget(G.run, sc.lead);
        if (sc.kind === "escape") placeAhead(G.run, sc.lead);
        data.said = 0;
        await view.preload();
      }
    } catch (e) { console.error(e); }
    view.debugCam = null; busy = false; t = 0; data.wall = nowMs();
  }
  function restoreCar() {
    if (!saved) return; G.copsOff = false; G.player = saved; saved = null; G.traffic.length = 0; view.refreshPlayer(); view.setCameraMode(0); view.cam.snap = true;
    G.weather.rain = 0.15; G.weather.target = 0.15; G.wet = false;
  }
  function leave() {
    if (!sc) return;
    hush();
    if (sc.kind === "dash") { restoreCar(); if (sc.footage) { S.got = { ...(S.got || {}), [sc.footage]: true }; S.footage = Object.keys(S.got).length; save(); } }
    if (sc.kind === "goto") G.clearWaypoint && G.clearWaypoint();
    if (mission(sc.kind) && G.run) G.abortEvent(true);
    view.debugCam = null;
  }
  function next() { leave(); enter(idx + 1); }
  function retry() { leave(); enter(idx, true); }
  function endChapter() { S.cleared = { ...S.cleared, [ch]: true }; save(); }
  function nextChapter() { if (ch >= CHAPTER_FNS.length) return false; leave(); ch += 1; S.ch = ch; S.at = 0; scenes = storyScenes(ch); enter(0); return true; }

  function placeTarget(run, lead) { // the car you tail starts a little way down the road ahead of you, already rolling
    if (!run || !run.racers || !run.racers[0]) return;
    const r = run.racers[0], pts = run.route.pts; let k = 0; while (k < pts.length - 2 && pts[k].s < lead) k++;
    const a = pts[k], b = pts[Math.min(pts.length - 1, k + 1)], yaw = Math.atan2(b.z - a.z, b.x - a.x);
    r.v.x = a.x; r.v.z = a.z; r.v.y = a.y; r.v.yaw = yaw; if (r.drv) r.drv.pi = k;
    run.cd = Math.min(run.cd, 1.2); // a short beat, not a race countdown
  }
  function placeAhead(run, lead) { // in an escape you start with a head start; the hunters line up behind you
    if (!run || !run.route) return; const pts = run.route.pts, P = G.player; let k = 0; while (k < pts.length - 2 && pts[k].s < lead) k++;
    const a = pts[k], b = pts[Math.min(pts.length - 1, k + 1)], yaw = Math.atan2(b.z - a.z, b.x - a.x);
    P.x = a.x; P.z = a.z; P.y = a.y; P.yaw = yaw; P.vx = P.vz = 0; P.speed = 0;
    run.cd = Math.min(run.cd, 1.6);
  }
  function setFail(f) { fail = f; lineT = 0; hush(); if (!f.good && sfx.wrong) sfx.wrong(); if (f.good && sfx.correct) sfx.correct(); }
  function radioStep(dt, prog) { // radio calls during a mission, at points along the way (goto) or at seconds into it (missions)
    const rl = sc.radio || [];
    while (data.said < rl.length && prog >= rl[data.said][0]) { const [, who, text] = rl[data.said]; radioMsg = { who, text, t: 0 }; data.said++; if (sfx.tap) sfx.tap(); speak(who, text); }
    if (radioMsg && (radioMsg.t += dt) > 5.5 && !(voice && voice.speaking)) radioMsg = null;
  }

  // ---- per frame ----------------------------------------------------------------------------------------------------------------------
  function tick(dt) {
    if (!alive || !sc) return;
    hold();
    t += dt;
    if (busy) return;
    if (fail) { lineT += dt; return; }
    if (sc.kind === "card") { if (t >= sc.secs && !(voice && voice.speaking)) next(); return; }
    if (sc.kind === "end") return;
    if (sc.kind === "talk") {
      const L = sc.lines[lineI]; if (!L) { next(); return; }
      if (lineT === 0) { data.speaking = true; data.voiced = speak(L[0], L[1], () => { data.speaking = false; }); }
      lineT += dt; const full = lineT * 46 >= L[1].length; const fullAt = L[1].length / 46;
      const holdFor = data.voiced ? 0.55 : 2.2 + L[1].length * 0.045;
      if (wantNext) { wantNext = false; if (!full) lineT = fullAt + 0.01; else { hush(); data.speaking = false; data.doneAt = null; lineI++; lineT = 0; if (sfx.tap) sfx.tap(); } }
      else if (full && !data.speaking) {
        if (data.doneAt == null) data.doneAt = lineT; // when the voice finished (or the text finished, with no voice)
        if (lineT - Math.max(fullAt, data.doneAt) > holdFor) { lineI++; lineT = 0; data.doneAt = null; }
      }
      if (lineI >= sc.lines.length) next();
      return;
    }
    if (sc.kind === "dash") {
      G.traffic.length = 0; wantNext = false;
      const L = sc.lines;
      if (data.li < L.length && t >= L[data.li][0] && !data.speaking && t >= data.gapUntil) {
        const [, who, text] = L[data.li]; data.cur = data.li; data.curT = t; data.li++; data.speaking = true;
        speak(who, text, () => { data.speaking = false; data.gapUntil = t + 0.3; if (data.li >= L.length) data.doneT = t; });
      }
      const endT = Math.max(sc.secs, data.doneT ? data.doneT + 1.4 : 0);
      if (data.li >= L.length && !data.speaking && t >= endT) next();
      data.endT = endT;
      return;
    }
    if (sc.kind === "goto") {
      const P = G.player, d = Math.hypot(data.to[0] - P.x, data.to[1] - P.z); data.d = d;
      radioStep(dt, 1 - d / data.d0);
      if (data.limit) { data.left -= dt; if (data.left <= 0) { G.clearWaypoint && G.clearWaypoint(); setFail({ title: (sc.lose || ["OUT OF TIME"])[0], text: (sc.lose || ["", "Try again."])[1] }); return; } }
      if (d < (sc.radius || 50) && P.speed < 22) next();
      else if (d < (sc.radius || 50)) data.slow = true;
      return;
    }
    // ---- missions
    const run = G.run;
    if (run && run.state === "go") radioStep(dt, run.t || 0);
    if (sc.kind === "race" || sc.kind === "drift") {
      if (G.state === "result" && G.result) { const won = !!G.result.win && (sc.kind !== "drift" || (G.result.score || 0) >= (sc.need || 0)); const sco = G.result.score; G.closeResult(); G.run = null; setFail(won ? { title: sc.win[0], text: sc.win[1] + (sco != null ? `  ·  ${sco.toLocaleString()} pts` : ""), good: true } : { title: sc.lose[0], text: sc.lose[1] + (sco != null ? `  ·  ${sco.toLocaleString()} pts` : "") }); return; }
      if (!run) setFail({ title: sc.lose[0], text: sc.lose[1] });
      return;
    }
    if (sc.kind === "tail") {
      if (G.state === "result") { G.closeResult(); G.run = null; setFail({ title: sc.lose[0], text: "You drove past them. They saw your face." }); return; }
      if (!run) { setFail({ title: sc.lose[0], text: sc.lose[1] }); return; }
      if (run.state !== "go") return;
      const r = run.racers[0], P = G.player; const d = Math.hypot(r.v.x - P.x, r.v.z - P.z); data.d = d;
      { const v = r.v, c = Math.cos(v.yaw), sn = Math.sin(v.yaw); // the car you tail never gets stuck behind traffic: cars in its path quietly turn off
        for (let q = G.traffic.length - 1; q >= 0; q--) { const tr = G.traffic[q], dx = tr.x - v.x, dz = tr.z - v.z; const f = dx * c + dz * sn, side = Math.abs(-dx * sn + dz * c); if (f > -4 && f < 45 && side < 5 && Math.hypot(tr.x - P.x, tr.z - P.z) > 30) G.traffic.splice(q, 1); } }
      const ahead = (r.v.x - P.x) * Math.cos(P.yaw) + (r.v.z - P.z) * Math.sin(P.yaw);
      data.hot = data.hot || 0; data.cold = data.cold || 0;
      const moving = r.v.speed > 7; // sitting right behind it at a red light is normal; riding its bumper while it drives is not
      if ((d < sc.near && (moving || d < 9)) || (ahead < -6 && d < 40)) data.hot += dt; else data.hot = Math.max(0, data.hot - dt * 0.6);
      if (d > sc.far) data.cold += dt; else data.cold = Math.max(0, data.cold - dt);
      if (r.finished || r.drv.pi >= run.route.pts.length - 3) { G.abortEvent(true); setFail({ title: sc.win[0], text: sc.win[1], good: true }); return; }
      if (data.hot > 2.6) { G.abortEvent(true); setFail({ title: sc.lose[0], text: sc.lose[1] }); return; }
      if (data.cold > 7) { G.abortEvent(true); setFail({ title: sc.lost[0], text: sc.lost[1] }); return; }
      return;
    }
    if (sc.kind === "escape") {
      if (G.state === "result" && G.result) { const won = (G.result.pos || 0) === 1; G.closeResult(); G.run = null; setFail(won ? { title: sc.win[0], text: sc.win[1], good: true } : { title: sc.lose[0], text: sc.lose[1] }); return; }
      if (!run) { setFail({ title: sc.lose[0], text: sc.lose[1] }); return; }
      if (run.state !== "go") return;
      const P = G.player; let dmin = 1e9; for (const r of run.racers) { if (r.out) continue; const d = Math.hypot(r.v.x - P.x, r.v.z - P.z); if (d < dmin) dmin = d; }
      data.d = dmin; data.clear = data.clear || 0; data.grab = data.grab || 0;
      if (dmin > sc.gap) data.clear += dt; else data.clear = Math.max(0, data.clear - dt * 2);
      if (dmin < 7 && P.speed < 9) data.grab += dt; else data.grab = Math.max(0, data.grab - dt);
      if (data.clear > 3.5) { G.abortEvent(true); setFail({ title: sc.win[0], text: sc.win[1], good: true }); return; }
      if (data.grab > 2.2) { G.abortEvent(true); setFail({ title: sc.lose[0], text: sc.lose[1] }); return; }
      return;
    }
  }
  function input(raw) {
    if (!sc || busy) return PARK;
    if (fail) return PARK;
    if (sc.kind === "dash") return autopilot(G.player, 0.85);
    if (sc.kind === "talk" || sc.kind === "card" || sc.kind === "end") return PARK;
    return raw;
  }
  function frame() {
    if (!sc || busy) { push(); return; }
    const P = G.player;
    if (sc.kind === "talk" && data.p0 && !fail) {
      const p0 = data.p0, s = data.side, c = Math.cos(p0.yaw), sn = Math.sin(p0.yaw);
      let cam;
      if (sc.cam === "low") { const a = p0.yaw + s * (0.75 - t * 0.012), r = 5.6 - Math.min(1.2, t * 0.03); cam = { x: P.x + Math.cos(a) * r, y: P.y + 0.75, z: P.z + Math.sin(a) * r, lx: P.x, ly: P.y + 0.7, lz: P.z }; }
      else if (sc.cam === "high") { const a = p0.yaw + Math.PI + s * (0.5 + t * 0.02), r = 16 - Math.min(5, t * 0.1); cam = { x: P.x + Math.cos(a) * r, y: P.y + 8.5 - Math.min(3.5, t * 0.07), z: P.z + Math.sin(a) * r, lx: P.x + c * 3, ly: P.y + 0.6, lz: P.z + sn * 3 }; }
      else { const a = p0.yaw + Math.PI * 0.8 * s + t * 0.06 * s, r = 6.8; cam = { x: P.x + Math.cos(a) * r, y: P.y + 1.55, z: P.z + Math.sin(a) * r, lx: P.x, ly: P.y + 0.6, lz: P.z }; }
      view.debugCam = cam;
    } else if (sc.kind === "card" || sc.kind === "end") {
      const a = t * 0.05, r = 9; view.debugCam = { x: P.x + Math.cos(a) * r, y: P.y + 2.4, z: P.z + Math.sin(a) * r, lx: P.x, ly: P.y + 0.6, lz: P.z };
    } else if (sc.kind === "dash") { // a camera stuck to the windscreen, with a little road shake
      const c = Math.cos(P.yaw), sn = Math.sin(P.yaw), sh = Math.sin(t * 23) * 0.012 * Math.min(1, P.speed / 20);
      view.debugCam = { x: P.x + c * 0.35, y: P.y + 1.22 + sh, z: P.z + sn * 0.35, lx: P.x + c * 40, ly: P.y + 0.6 + sh * 8, lz: P.z + sn * 40, roll: Math.sin(t * 1.3) * 0.006 };
    } else view.debugCam = null;
    push();
  }

  // ---- what the screen should show ---------------------------------------------------------------------------------------------------
  function lineUi(who, text, shown, extra = {}) { const c = CAST[who] || CAST.you; return { who, name: c.name, role: c.role, color: c.color, phone: !!c.phone, tape: !!c.tape, text, shown, ...extra }; }
  function push(force) {
    const now = nowMs();
    if (!force && now - uiT < 45) return; uiT = now;
    if (!opts.onUi) return;
    const u = { kind: busy ? "busy" : sc ? sc.kind : "busy", t, footage: S.footage || 0, footageTotal: FOOTAGE_TOTAL, chapter: ch, chapters: CHAPTER_FNS.length, chapterTitle: CHAPTERS[ch - 1].title, idx, n: scenes.length, voice: voice ? { on: voice.on, available: voice.available } : null };
    if (busy) { opts.onUi(u); return; }
    const wall = (now - (data.wall || now)) / 1000; // the fade-in runs on the real clock, so a slow frame never leaves the picture dark
    u.fade = sc.kind === "card" || sc.kind === "end" ? 1 : Math.max(0, 1 - Math.max(t, wall) / 0.7);
    if (sc.grade) u.grade = sc.grade;
    if (sc.kind === "card") { u.card = { kicker: sc.kicker, big: sc.big, sub: sc.sub, a: t, b: sc.secs }; }
    if (sc.kind === "end") { u.card = { big: sc.big, sub: sc.sub, note: sc.note, end: true, final: !!sc.final, nextCh: !sc.final && ch < CHAPTER_FNS.length ? ch + 1 : 0, nextTitle: !sc.final && ch < CHAPTER_FNS.length ? CHAPTERS[ch].title : "" }; }
    if (sc.kind === "talk") { const L = sc.lines[Math.min(lineI, sc.lines.length - 1)]; if (L) u.line = lineUi(L[0], L[1], Math.min(L[1].length, Math.floor(lineT * 46)), { i: lineI, n: sc.lines.length, speaking: !!(voice && voice.speaking) }); u.place = sc.place; u.bars = true; }
    if (sc.kind === "dash") {
      const c = sc.clock, base = Date.UTC(c[0], c[1] - 1, c[2], c[3], c[4], c[5]) + t * 1000; const d = new Date(base); const p2 = (v) => String(v).padStart(2, "0");
      const endT = data.endT || sc.secs;
      u.dash = { clock: `${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}  ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`, kmh: Math.round(G.player.speed * 3.6), flash: sc.flash && data.li >= sc.lines.length && !data.speaking ? Math.max(0, (t - (endT - 1.1)) / 1.1) : 0, label: sc.label || "", end: endT - t };
      if (data.cur != null && (data.speaking || t - data.curT < 4.2)) { const L = sc.lines[data.cur]; u.line = lineUi(L[1], L[2], Math.min(L[2].length, Math.floor((t - data.curT) * 40)), { tape: true }); }
      u.fade = Math.max(0, 1 - Math.max(t, wall) / 1.2);
    }
    if (radioMsg) u.radio = lineUi(radioMsg.who, radioMsg.text, radioMsg.text.length);
    if (sc.kind === "goto") u.obj = { title: "OBJECTIVE", text: sc.text, d: data.d != null ? Math.round(data.d) : null, slow: !!data.slow, left: data.limit ? Math.max(0, data.left) : null };
    if (sc.kind === "race") u.obj = { title: sc.title, text: sc.text, sync: true };
    if (sc.kind === "drift") u.obj = { title: sc.title, text: sc.text };
    if (sc.kind === "escape") u.obj = { title: sc.title, text: sc.text, d: data.d != null && data.d < 1e8 ? Math.round(data.d) : null, gap: sc.gap, clear: Math.min(1, (data.clear || 0) / 3.5) };
    if (sc.kind === "tail") { const hot = data.hot || 0, cold = data.cold || 0; u.obj = { title: sc.title, text: sc.text }; u.tail = { d: data.d != null ? Math.round(data.d) : null, near: sc.near, far: sc.far, warn: hot > 0.3 ? "TOO CLOSE" : cold > 0.5 ? "LOSING THEM" : "", heat: Math.min(1, hot / 2.6), chill: Math.min(1, cold / 7) }; }
    if (fail) { u.result = { title: fail.title, text: fail.text, good: !!fail.good, ready: lineT > 0.8 }; u.fade = 0; }
    opts.onUi(u);
  }

  // ---- player actions -----------------------------------------------------------------------------------------------------------------
  function advance() {
    if (!sc || busy) return;
    if (fail) { if (lineT < 0.8) return; if (fail.good) next(); else retry(); return; }
    if (sc.kind === "talk") { wantNext = true; return; }
    if (sc.kind === "card") { hush(); next(); return; }
    if (sc.kind === "dash") { if (t > 1.5) next(); return; }
    if (sc.kind === "end") { if (!sc.final && ch < CHAPTER_FNS.length) nextChapter(); else if (opts.onExit) opts.onExit(); }
  }
  function skipScene() { if (!sc || busy || fail) return; if (sc.kind === "talk" || sc.kind === "card" || sc.kind === "dash") next(); }
  function start() { enter(Math.max(0, Math.min(scenes.length - 1, S.at || 0))); }
  function dispose() { alive = false; try { leave(); } catch {} hush(); if (view.resumeAutoClock) try { view.resumeAutoClock(); } catch {} }

  return {
    start, tick, input, frame, advance, skipScene, dispose, nextChapter,
    get cinematic() { return !!sc && (busy || !!fail || sc.kind === "talk" || sc.kind === "card" || sc.kind === "dash" || sc.kind === "end"); },
    get scene() { return sc; }, get index() { return idx; }, get busy() { return busy; }, get chapter() { return ch; },
    pauseVoice(p) { if (voice) { if (p) voice.pause(); else voice.resume(); } },
    jump(i, c) { leave(); if (c && c !== ch) { ch = c; S.ch = c; scenes = storyScenes(c); } enter(i); }, // (tests)
  };
}
