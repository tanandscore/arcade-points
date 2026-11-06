// Screenshots for the public /gallery page. Every image is a real in-game capture (1920x1080, saved as high-quality JPEG in /public/gallery).
// To swap a picture, replace the file with the same name; to add one, add a line to `shots`.
export const GALLERY = [
  {
    slug: "midnightburn",
    kicker: "Open-world night racing",
    blurb: "Drive a living city after dark. Tokyo neon, Mumbai's coastline in 2046, rain, fog and storms, quests on every map, and a garage to build your dream car.",
    points: ["6 night maps", "Rain, fog & storms", "Quests in every map", "Garage & upgrades"],
    shots: [
      { src: "/gallery/mb-tokyo-neon.jpg", alt: "Midnight Burn: a sports car on a wide Tokyo avenue lined with glowing neon signboards at night", cap: "Neon Tokyo" },
      { src: "/gallery/mb-tokyo-air.jpg", alt: "Midnight Burn: a night-time view over a Tokyo expressway and lit-up city blocks", cap: "Over the expressway" },
      { src: "/gallery/mb-tokyo-wangan.jpg", alt: "Midnight Burn: an empty Tokyo bay-shore highway with neon signs on both sides", cap: "Bayshore run" },
      { src: "/gallery/mb-mumbai-marine.jpg", alt: "Midnight Burn: Marine Drive and the Mumbai skyline beside the sea at golden hour in 2046", cap: "Marine Drive, Mumbai 2046" },
      { src: "/gallery/mb-mumbai-coast.jpg", alt: "Midnight Burn: the wide Coastal Road beside the sea with a landscaped promenade, Haji Ali in the distance", cap: "The Coastal Road" },
      { src: "/gallery/mb-tokyo-street.jpg", alt: "Midnight Burn: a sports car at a Tokyo junction under traffic lights", cap: "City junction" },
    ],
  },
  {
    slug: "operationblacksite",
    kicker: "Tactical 3D shooter",
    blurb: "Buy your gear, plant or defuse the bomb, and outsmart bots that really hunt you, across four detailed maps.",
    points: ["Buy phase", "Plant & defuse", "Smart bots", "4 maps"],
    shots: [
      { src: "/gallery/bs-bazaar.jpg", alt: "Operation Blacksite: first-person view in the Bazaar map", cap: "Bazaar" },
      { src: "/gallery/bs-harbor.jpg", alt: "Operation Blacksite: first-person view in the Harbor map", cap: "Harbor" },
      { src: "/gallery/bs-foundry.jpg", alt: "Operation Blacksite: first-person view in the Foundry map", cap: "Foundry" },
      { src: "/gallery/bs-quarter.jpg", alt: "Operation Blacksite: first-person view in the Quarter map", cap: "Quarter" },
    ],
  },
  {
    slug: "kingdomsofash",
    kicker: "Cozy town builder",
    blurb: "Stack colourful houses over the water, plant rooftop gardens and watch your town glow when night falls. Calm, deep and endlessly creative.",
    points: ["Build a kingdom", "Day & night", "Calm & deep"],
    shots: [
      { src: "/gallery/ash-day.jpg", alt: "A colourful town built over turquoise water in daylight", cap: "Daytime harbour" },
      { src: "/gallery/ash-night.jpg", alt: "The same town at night with glowing windows", cap: "Night falls" },
    ],
  },
  {
    slug: "wrathofolympus",
    kicker: "Real-time strategy",
    blurb: "Command heroes, gods and armies. Use divine powers, push through fog of war and take the mountain.",
    points: ["Divine powers", "Heroes & gods", "Fog of war"],
    shots: [
      { src: "/gallery/ol-battle.jpg", alt: "Wrath of Olympus: units gathered on the battlefield", cap: "On the field" },
    ],
  },
];
