import dynamic from "next/dynamic";
import GameLoadingInline from "./GameLoadingInline";

// Every game component receives these props:
//   onFinish(score: number) — call once when a run ends (the flagship games use this)
//   onScore(score: number) -> Promise<{ isNewBest, best, xpGained, error }> — optional, used by the 2D games: it saves a score
//                             quietly after every level, without opening the result overlay
//   onExit() — optional, asks the page to leave the game
//   accentColor: string — the game's theme color
// The keys here must match a game's slug in lib/catalog.js.
//
// Each entry is a next/dynamic() import, NOT a static import — this is what makes visiting one game only download that game's
// code, instead of every game bundled together on every single game page. ssr: false because every game touches
// canvas/window/audio APIs that don't exist during server rendering.
//
// Upgrade 70: the store now holds the 4 Legend Pass flagships plus the new 2D games. The older arcade games were retired from
// the store; their files are still in this folder but are no longer loaded by anything.
export const GAME_COMPONENTS = {
  // Legend Pass — the four flagships
  midnightburn: dynamic(() => import("@/midnightburn/MidnightBurn"), { ssr: false, loading: GameLoadingInline }),
  operationblacksite: dynamic(() => import("@/blacksite/OperationBlacksite"), { ssr: false, loading: GameLoadingInline }),
  kingdomsofash: dynamic(() => import("@/kingdoms/KingdomsOfAsh"), { ssr: false, loading: GameLoadingInline }),
  wrathofolympus: dynamic(() => import("@/olympus/WrathOfOlympus"), { ssr: false, loading: GameLoadingInline }),

  // Power Pass
  skylinesiege: dynamic(() => import("@/arcade2d/games/SkylineSiege"), { ssr: false, loading: GameLoadingInline }),

  // Free
  kikoleap: dynamic(() => import("@/arcade2d/games/KikoLeap"), { ssr: false, loading: GameLoadingInline }),
  gemgarden: dynamic(() => import("@/arcade2d/games/GemGarden"), { ssr: false, loading: GameLoadingInline }),
  blastgrid: dynamic(() => import("@/arcade2d/games/BlastGrid"), { ssr: false, loading: GameLoadingInline }),
  puttplanet: dynamic(() => import("@/arcade2d/games/PuttPlanet"), { ssr: false, loading: GameLoadingInline }),
  snipdrop: dynamic(() => import("@/arcade2d/games/SnipDrop"), { ssr: false, loading: GameLoadingInline }),
  cratecourier: dynamic(() => import("@/arcade2d/games/CrateCourier"), { ssr: false, loading: GameLoadingInline }),
  gardenguards: dynamic(() => import("@/arcade2d/games/GardenGuards"), { ssr: false, loading: GameLoadingInline }),
  starlinevanguard: dynamic(() => import("@/arcade2d/games/StarlineVanguard"), { ssr: false, loading: GameLoadingInline }),
  emberdeck: dynamic(() => import("@/arcade2d/games/EmberDeck"), { ssr: false, loading: GameLoadingInline }),
  hollowdeep: dynamic(() => import("@/arcade2d/games/HollowDeep"), { ssr: false, loading: GameLoadingInline }),
  fluffapult: dynamic(() => import("@/arcade2d/games/Fluffapult"), { ssr: false, loading: GameLoadingInline }),
};
