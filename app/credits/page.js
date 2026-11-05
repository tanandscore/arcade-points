import LegalPage, { LegalSection } from "@/components/store/LegalPage";

export const metadata = {
  title: "Credits",
  alternates: { canonical: "/credits" },
  description: "The artists whose 3D car models appear in Midnight Burn, and the licence they are shared under.",
};

// Every car in Midnight Burn is a model made by an independent artist and shared under the Creative Commons Attribution 4.0 licence (CC BY 4.0).
// The licence asks us to name the artist and the work, link the licence, and say if we changed it. This page does that.
const LICENCE = "https://creativecommons.org/licenses/by/4.0/";
const WORKS = [
  ["Porsche 930 Turbo", "Lionsharp Studios", "Rennsport Turbo"],
  ["Fiat Punto GT", "Lionsharp Studios", "Pocket Rocket"],
  ["BMW M3 E30", "Martin Trafas", "Kestrel"],
  ["Oldsmobile Cutlass", "Barbo", "Brute"],
  ["ZIS-101A Sport 1938", "Comrade1280", "Gilded Roadster"],
  ["Lotus Élise", "Stéphane Agullo", "Stinger"],
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
      <LegalSection id="changes" title="What we changed">
        <p>We changed every model to fit the game: we resized it, split the wheels off so they spin and steer, removed brand badges, replaced the number plates with the game&apos;s own, simplified the shapes and compressed the textures so they load fast, and made the paint, rims, lights and glass editable in the Garage. For the street props we stood each one upright, set it to real-world size, simplified it and merged its textures into one picture; the lamp lights glow at night. For the forests we cut the trees, bushes, grass and leaves out of the scene and lay them over the game's hills so they follow the ground. For the buildings, we cut single buildings out of larger city scenes, straightened them, simplified the shapes, merged their textures into one picture and added lit windows for night. None of the artists endorse Tap &amp; Score or Midnight Burn.</p>
      </LegalSection>
      <LegalSection id="trademarks" title="Real car names">
        <p>The cars in the game have their own names. Any resemblance to a real car comes from the artist&apos;s model. Car makers and their trademarks belong to their owners and are not connected to this game.</p>
      </LegalSection>
    </LegalPage>
  );
}
