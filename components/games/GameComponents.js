import ReflexTap from "./ReflexTap";
import MemoryMatch from "./MemoryMatch";
import MathRush from "./MathRush";
import NeonSnake from "./NeonSnake";
import MoleRush from "./MoleRush";
import Sequence from "./Sequence";
import TypingRush from "./TypingRush";
import ColorRush from "./ColorRush";
import DigitSpan from "./DigitSpan";
import TicTacDuel from "./TicTacDuel";
import WordScramble from "./WordScramble";
import QuickTrivia from "./QuickTrivia";
import LaneDash from "./LaneDash";
import PixelJumper from "./PixelJumper";
import EmpireCommand from "./EmpireCommand";
import TurboCircuit from "./TurboCircuit";
import ColonyRush from "./ColonyRush";
import EchoChase from "./EchoChase";
import PulseMaze from "./PulseMaze";
import StrikeZone from "./StrikeZone";
import PlatformQuest from "./PlatformQuest";
import CreatureClash from "./CreatureClash";
import BrickBlaster from "./BrickBlaster";
import BlockCascade from "./BlockCascade";
import MazeMuncher from "./MazeMuncher";
import ApexCircuit from "./ApexCircuit";
import Dominion from "./Dominion";
import TerritoryDuel from "./TerritoryDuel";
import GrandPrixDuel from "./GrandPrixDuel";
import StarDefender from "./StarDefender";
import VoidDrifter from "./VoidDrifter";
import SwarmBreach from "./SwarmBreach";
import SkyRaiders from "./SkyRaiders";
import PeakAscent from "./PeakAscent";
import HorizonGuardian from "./HorizonGuardian";
import DuelArena from "./DuelArena";
import FrontlineMarksman from "./FrontlineMarksman";
import FruitChase from "./FruitChase";
import IronFist from "./IronFist";
import ShellSquad from "./ShellSquad";
import RimRockers from "./RimRockers";
import BeatRush from "./BeatRush";
import TitanArena from "./TitanArena";
import Duskward from "./Duskward";
import BloodmoonSiege from "./BloodmoonSiege";
import StarfallOverrun from "./StarfallOverrun";
import ArcaneSurvivor from "./ArcaneSurvivor";
import ArenaSurvivor from "./ArenaSurvivor";
import Shadowfall from "./Shadowfall";
import Driftlight from "./Driftlight";
import OperationBlacksite from "./OperationBlacksite";
import NeonDrift from "./NeonDrift";
import KingdomsOfAsh from "./KingdomsOfAsh";
import Emberlight from "./Emberlight";

// Every game component receives exactly two props:
//   onFinish(score: number) — call once when the game ends
//   accentColor: string — the game's theme color from the games table
// The keys here must match a game's component_key column in Supabase.
export const GAME_COMPONENTS = {
  reflex: ReflexTap,
  memory: MemoryMatch,
  math: MathRush,
  snake: NeonSnake,
  whackamole: MoleRush,
  simonsays: Sequence,
  typing: TypingRush,
  colormatch: ColorRush,
  numbermemory: DigitSpan,
  tictactoe: TicTacDuel,
  wordscramble: WordScramble,
  trivia: QuickTrivia,
  lanedash: LaneDash,
  pixeljumper: PixelJumper,
  empirecommand: EmpireCommand,
  turbocircuit: TurboCircuit,
  colonyrush: ColonyRush,
  echochase: EchoChase,
  pulsemaze: PulseMaze,
  strikezone: StrikeZone,
  platformquest: PlatformQuest,
  creatureclash: CreatureClash,
  brickblaster: BrickBlaster,
  blockcascade: BlockCascade,
  mazemuncher: MazeMuncher,
  apexcircuit: ApexCircuit,
  dominion: Dominion,
  territoryduel: TerritoryDuel,
  grandprixduel: GrandPrixDuel,
  stardefender: StarDefender,
  voiddrifter: VoidDrifter,
  swarmbreach: SwarmBreach,
  skyraiders: SkyRaiders,
  peakascent: PeakAscent,
  horizonguardian: HorizonGuardian,
  duelarena: DuelArena,
  frontlinemarksman: FrontlineMarksman,
  fruitchase: FruitChase,
  ironfist: IronFist,
  shellsquad: ShellSquad,
  rimrockers: RimRockers,
  beatrush: BeatRush,
  titanarena: TitanArena,
  duskward: Duskward,
  bloodmoonsiege: BloodmoonSiege,
  starfalloverrun: StarfallOverrun,
  arcanesurvivor: ArcaneSurvivor,
  arenasurvivor: ArenaSurvivor,
  shadowfall: Shadowfall,
  driftlight: Driftlight,
  operationblacksite: OperationBlacksite,
  neondrift: NeonDrift,
  kingdomsofash: KingdomsOfAsh,
  emberlight: Emberlight,
};
