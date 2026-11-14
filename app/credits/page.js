import LegalPage, { LegalSection } from "@/components/store/LegalPage";

export const metadata = {
  title: "Credits",
  alternates: { canonical: "/credits" },
  description: "The artists whose 3D car models appear in Midnight Burn, and the licence they are shared under.",
};

// Every car in Midnight Burn is a model made by an independent artist and shared under the Creative Commons Attribution 4.0 licence (CC BY 4.0).
// The licence asks us to name the artist and the work, link the licence, and say if we changed it. This page does that.
const SOLDIERS = [
  ["Tm Phoenix V2 - characters (CC BY 4.0)", "ErhanMatur", "Nightfall soldier"],
  ["csgo terrorist characters (CC BY 4.0)", "ErhanMatur", "Nightfall soldier"],
  ["German KSK operator - rigged (CC BY 4.0)", "42manako", "Sentinel soldier"],
];
const GUNS = [
  ["HK MP5 (CC BY 4.0)", "spelunkygamer12", "Hawk MP"],
  ["MP5 sub machine gun (CC BY 4.0)", "Team-Panda", "Reaper SMG"],
  ["Sub machine gun (CC BY 4.0)", "Liam kendall", "Scorp SMG"],
  ["Pistol (CC BY 4.0)", "SINNIK", "Viper"],
  ["Low-poly Desert Eagle (CC BY 4.0)", "TastyTony", "Jackal .50"],
  ["AK47 (CC BY 4.0)", "wburton", "Ironwood AK"],
  ["Low-poly AK-105 Kochevnik bullpup (CC BY 4.0)", "notcplkerry", "Nomad-105"],
  ["Sunda Mk2 300 bullpup (CC BY 4.0)", "ErhanMatur", "Dune Mk2"],
  ["Gun M4A1 (CC BY 4.0)", "Ivan008", "Warden M4"],
  ["Low-poly M16A4 (CC BY 4.0)", "LowPolyCount", "Guardian A4"],
  ["Low-poly SA80 assault rifle (CC BY 4.0)", "LowPolyCount", "Lionheart L85"],
  ["Low-poly AUG A1 (CC BY 4.0)", "TastyTony", "Alpine AUG"],
  ["Gun (CC BY 4.0)", "Dries Deryckere", "Ranger Carbine"],
  ["Modern sniper (CC BY 4.0)", "Vlasov Daniil", "Longshot Sniper"],
  ["Sniper rifle futuristic (CC BY 4.0)", "trolosqlfod", "Ghost-X"],
  ["HK G28 sniper rifle (CC BY 4.0)", "trolosqlfod", "Marshal G28"],
];
const LICENCE = "https://creativecommons.org/licenses/by/4.0/";
const WORKS = [
  ["Porsche 930 Turbo", "Lionsharp Studios", "Rennsport Turbo"],
  ["Fiat Punto GT", "Lionsharp Studios", "Pocket Rocket"],
  ["BMW M3 E30", "Martin Trafas", "Kestrel"],
  ["Oldsmobile Cutlass", "Barbo", "Brute"],
  ["ZIS-101A Sport 1938", "Comrade1280", "Gilded Roadster"],
  ["Lotus Élise", "Stéphane Agullo", "Stinger"],
  ["1972 Datsun 240k GT (CC BY-SA 4.0)", "Karol Miklas", "Sunrise 240"],
  ["Porsche 911 Carrera 4S (CC BY-SA 4.0)", "Karol Miklas", "Autobahn 4S"],
  ["Bentley Car Model (CC BY 4.0)", "Render_Vendor", "Sovereign GT"],
  ["2004 Cadillac CTS-V race car (CC BY 4.0)", "Dave Love SketchFab", "Warhawk V"],
  ["Hyundai N74 (N Vision 74) (CC BY 4.0)", "MojoLeeDa", "Ember 74"],
  ["Race Car 01 (CC BY 4.0)", "toddeppe", "Ghost GT"],
  ["BMW M2 Widebody Drift Car (CC BY 4.0)", "Drifter Models", "Kaiser Drift"],
  ["Mazda Furai Race Car (CC BY 4.0)", "DRIVER-FIRE", "Furai X"],
  ["2024 Porsche 992 GT3 R (CC BY 4.0)", "Dave Love SketchFab", "Apex GT3-R"],
  ["Lotus Renault F1 Car (CC BY 4.0)", "Kanedog", "Formula L1"],
  ["NEW F1 CAR 2026 (CC BY 4.0)", "Abu Saif", "Formula 26"],
  ["\"130\" (coupe)", "mononofu", "Zephyr Z"],
  ["Phoenix 455", "Daniel Zhabotinsky", "Phoenix 455"],
  ["Mercedes 300SL", "Lexyc16", "Gullwing 300"],
  ["Police car", "SpatialNeglect", "Patrol Cruiser"],
  ["BMW M4 F82", "Black Snow", "Razor RX"],
  ["Nissan GT-R R35", "Black Snow", "Meteor R"],
  ["Porsche 911 GT3 RS", "Black Snow", "Vesper RS"],
  ["Phoenix 455 Interceptor", "Daniel Zhabotinsky", "Phantom Interceptor, police units"],
  ["Cyberpunk car", "4d_Bob", "Specter X"],
  ["Fairheaven Cop Cruiser", "Daniel Zhabotinsky", "police units"],
  ["Generic car pack", "Comrade1280", "traffic cars"],
  ["Civil service vehicles pack", "Comrade1280", "taxi, bus and service vehicles in traffic"],
  ["Cyberpunk City (buildings)", "mortalityrexotable", "skyscrapers in the city"],
  ["Building", "mortalityrexotable", "city buildings"],
  ["City (buildings)", "abhayexe", "city buildings"],
  ["City for my game", "abhayexe", "city buildings"],
  ["New York City", "golukumar", "city buildings"],
  ["Low poly street lamps collection", "woulfric", "street lamps"],
  ["Abribus bus stop bus station", "Configcars / maxipub", "bus stops"],
  ["Standard bus stop", "Pukka Films", "bus stops"],
  ["Classic park bench", "solivoi228", "benches"],
  ["Street decor pack", "Kira", "benches"],
  ["Street hydrant", "yafrankk777", "fire hydrants"],
  ["Conjunto señales de tráfico", "danielrodriguezcarmona", "road signs"],
  ["Dirt road through the forest", "99.Miles", "pine forests over the hills"],
  ["Sakura tree 01", "Jogoss", "cherry trees"],
  ["A fantasy tree", "michael_grodkowski", "trees"],
  ["Japanese maple tree", "OliverMatheGames", "trees"],
  ["Oak tree", "massive-graphisme", "trees"],
  ["Tree 2", "Daniyal Malik", "trees"],
  ["Realistic tree models for games", "fadiyasotodeh", "trees"],
  ["Tree 1 (jasmine and mango)", "farhad.Guli", "trees"],
  ["Tree GN", "TechArtBGN", "trees"],
  ["Maple trees", "Jagobo", "red maple trees"],
  ["Trees set A", "Satendra Saraswat", "trees"],
  ["Road, Avenue, street (worn asphalt texture)", "ahmagh2e", "road"],
  ["Road HD (worn zebra crossing)", "Raph3D", "road"],
];

export default function CreditsPage() {
  return (
    <LegalPage
      title="Credits"
      lead={<>The cars in Midnight Burn were modelled by independent 3D artists who chose to share their work. Thank you. They are listed here, as the licence asks.</>}
    >
      <LegalSection id="cars" title="3D models: cars and buildings">
        <p>Each model below is used under the <a className="st-doclink" href={LICENCE} target="_blank" rel="noopener noreferrer">Creative Commons Attribution 4.0 licence</a> (CC BY 4.0). We found them on Sketchfab. The names in the right-hand column are the names the cars have inside the game.</p>
        <ul className="mt-4 space-y-3">
          {WORKS.map(([title, author, inGame]) => (
            <li key={title} className="st-band p-4">
              <p className="text-[15px] font-semibold text-[#f5f0ff]">{title}</p>
              <p className="text-[14px] mt-0.5">by {author}</p>
              <p className="text-[13.5px] mt-1 text-[#a99fd6]">In the game: {inGame}</p>
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection id="soldiers" title="3D models: soldiers in Operation Blacksite">
        <p>The soldiers in Operation Blacksite use the models below, also under CC BY 4.0 and also found on Sketchfab. We resized them, compressed the textures and re-posed them with the game&apos;s own animation. The team names, Nightfall and Sentinel, belong to this game.</p>
        <ul className="mt-4 space-y-3">
          {SOLDIERS.map(([title, author, inGame]) => (
            <li key={title} className="st-band p-4">
              <p className="text-[15px] font-semibold text-[#f5f0ff]">{title}</p>
              <p className="text-[14px] mt-0.5">by {author}</p>
              <p className="text-[13.5px] mt-1 text-[#a99fd6]">In the game: {inGame}</p>
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection id="guns" title="3D models: guns in Operation Blacksite">
        <p>Every firearm in Operation Blacksite is one of the models below, all under CC BY 4.0 and all found on Sketchfab. We resized them, moved them so they sit properly in a hand, trimmed loose parts, compressed the textures and gave them the game&apos;s own names and stats. The weapon names in the game are our own.</p>
        <ul className="mt-4 space-y-3">
          {GUNS.map(([title, author, inGame]) => (
            <li key={title} className="st-band p-4">
              <p className="text-[15px] font-semibold text-[#f5f0ff]">{title}</p>
              <p className="text-[14px] mt-0.5">by {author}</p>
              <p className="text-[13.5px] mt-1 text-[#a99fd6]">In the game: {inGame}</p>
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection id="changes" title="What we changed">
        <p>We changed every model to fit the game: we resized it, split the wheels off so they spin and steer, removed brand badges, replaced the number plates with the game&apos;s own, simplified the shapes and compressed the textures so they load fast, and made the paint, rims, lights and glass editable in the Garage. For the street props we stood each one upright, set it to real-world size, simplified it and merged its textures into one picture; the lamp lights glow at night. For the forests we cut the trees, bushes, grass and leaves out of the scene and lay them over the game's hills so they follow the ground. For the buildings, we cut single buildings out of larger city scenes, straightened them, simplified the shapes, merged their textures into one picture and added lit windows for night. None of the artists endorse Tap &amp; Score or Midnight Burn.</p>
      </LegalSection>
      <LegalSection id="sharealike" title="Share-alike models">
        <p>The Sunrise 240 and the Autobahn 4S are adapted from two models by Karol Miklas that are licensed CC BY-SA 4.0. Our adapted versions of those two models are shared under the same licence (https://creativecommons.org/licenses/by-sa/4.0/). The licence covers those two models only, not the rest of the game.</p>
      </LegalSection>
      <LegalSection id="trademarks" title="Real car names">
        <p>The cars in the game have their own names. Any resemblance to a real car comes from the artist&apos;s model. Car makers and their trademarks belong to their owners and are not connected to this game.</p>
      </LegalSection>
    </LegalPage>
  );
}
