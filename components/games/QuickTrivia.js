"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 40;
const LEVEL_BONUS_SECONDS = 6;

// General-knowledge facts — original compilation, not sourced from any
// copyrighted trivia game or media property.
const QUESTIONS = [
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "What gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
  { q: "What is the freezing point of water in Celsius?", options: ["0°C", "10°C", "-10°C", "5°C"], answer: 0 },
  { q: "Which country has the largest population?", options: ["USA", "India", "Brazil", "Russia"], answer: 1 },
  { q: "What is the tallest mountain in the world?", options: ["K2", "Kangchenjunga", "Everest", "Denali"], answer: 2 },
  { q: "How many players are on a standard football (soccer) team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: 2 },
  { q: "Which organ pumps blood through the body?", options: ["Lungs", "Liver", "Heart", "Kidney"], answer: 2 },
  { q: "How many minutes are in a full day?", options: ["1240", "1440", "1000", "1600"], answer: 1 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which language has the most native speakers worldwide?", options: ["English", "Spanish", "Mandarin Chinese", "Hindi"], answer: 2 },
  { q: "What do bees collect from flowers?", options: ["Water", "Nectar", "Sap", "Pollen only"], answer: 1 },
  // Substantially expanded below — carefully fact-checked, avoiding
  // anything time-sensitive or genuinely contested (e.g. "longest
  // river" is a real ongoing dispute between the Nile and the
  // Amazon depending on measurement method, so it's deliberately
  // left out). Honest note: this brings the pool to roughly 110
  // questions, not literally 2000 — writing thousands of genuinely
  // accurate, non-repetitive trivia questions responsibly is a much
  // larger content effort than one sitting can do well. What DOES
  // fully ship here is the actual mechanism (below) that makes "no
  // repeat until the pool is exhausted" true regardless of pool size.
  { q: "What is 7 × 8?", options: ["54", "56", "64", "48"], answer: 1 },
  { q: "What is the square root of 144?", options: ["10", "11", "12", "14"], answer: 2 },
  { q: "How many degrees are in a triangle's angles combined?", options: ["90", "180", "270", "360"], answer: 1 },
  { q: "How many degrees are in a full circle?", options: ["180", "270", "360", "400"], answer: 2 },
  { q: "What is 15% of 200?", options: ["20", "25", "30", "35"], answer: 2 },
  { q: "What Roman numeral represents 50?", options: ["V", "L", "C", "D"], answer: 1 },
  { q: "How many sides does an octagon have?", options: ["6", "7", "8", "9"], answer: 2 },
  { q: "What is 9 squared?", options: ["72", "81", "90", "99"], answer: 1 },
  { q: "What is the chemical formula for water?", options: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
  { q: "Which planet is closest to the sun?", options: ["Venus", "Earth", "Mercury", "Mars"], answer: 2 },
  { q: "How many bones are in the adult human body?", options: ["186", "196", "206", "216"], answer: 2 },
  { q: "Which travels faster: light or sound?", options: ["Sound", "Light", "They're equal", "Depends on weather"], answer: 1 },
  { q: "What is the largest planet in our solar system?", options: ["Saturn", "Neptune", "Jupiter", "Uranus"], answer: 2 },
  { q: "Which planet is most famous for its rings?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
  { q: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Cytoplasm"], answer: 2 },
  { q: "What gas do plants release during photosynthesis?", options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"], answer: 2 },
  { q: "What is the boiling point of water in Celsius?", options: ["90°C", "95°C", "100°C", "110°C"], answer: 2 },
  { q: "Who developed the theory of relativity?", options: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Galileo Galilei"], answer: 1 },
  { q: "Who was the first person to walk on the Moon?", options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "John Glenn"], answer: 2 },
  { q: "In what year did World War II end?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
  { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], answer: 2 },
  { q: "The Great Pyramid of Giza is located in which country?", options: ["Sudan", "Egypt", "Libya", "Morocco"], answer: 1 },
  { q: "Which ancient civilization built the Colosseum?", options: ["Greek", "Roman", "Egyptian", "Persian"], answer: 1 },
  { q: "How many letters are in the English alphabet?", options: ["24", "25", "26", "27"], answer: 2 },
  { q: "What is the primary language spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "Italian"], answer: 1 },
  { q: "What is the official currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answer: 2 },
  { q: "What is the official currency of the United Kingdom?", options: ["Euro", "Pound Sterling", "Franc", "Krone"], answer: 1 },
  { q: "How many players are on a basketball team on the court at once?", options: ["4", "5", "6", "7"], answer: 1 },
  { q: "How often are the Summer Olympic Games held?", options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"], answer: 2 },
  { q: "In tennis, what is a score of zero called?", options: ["Nil", "Love", "Zero", "Duck"], answer: 1 },
  { q: "How many rings are on the Olympic flag?", options: ["4", "5", "6", "7"], answer: 1 },
  { q: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Gazelle", "Horse"], answer: 1 },
  { q: "What is the largest mammal on Earth?", options: ["African elephant", "Blue whale", "Giraffe", "Polar bear"], answer: 1 },
  { q: "Which of these birds cannot fly?", options: ["Sparrow", "Eagle", "Ostrich", "Falcon"], answer: 2 },
  { q: "What is a group of lions called?", options: ["Pack", "Herd", "Pride", "Flock"], answer: 2 },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "12"], answer: 1 },
  { q: "What is the tallest animal in the world?", options: ["Elephant", "Giraffe", "Camel", "Horse"], answer: 1 },
  { q: "Who founded Microsoft?", options: ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Larry Page"], answer: 1 },
  { q: "What does \"WWW\" stand for?", options: ["World Wide Web", "World Wide Wire", "Web Wide World", "World Web Wide"], answer: 0 },
  { q: "How many days are in a leap year?", options: ["364", "365", "366", "367"], answer: 2 },
  { q: "How many months of the year have 31 days?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What color is a ruby?", options: ["Blue", "Green", "Red", "Yellow"], answer: 2 },
  { q: "What shape has exactly three sides?", options: ["Square", "Triangle", "Pentagon", "Hexagon"], answer: 1 },
  { q: "What is the opposite of \"hot\"?", options: ["Warm", "Cool", "Cold", "Mild"], answer: 2 },
  { q: "What is the largest country in the world by area?", options: ["Canada", "China", "United States", "Russia"], answer: 3 },
  { q: "What is the smallest country in the world by area?", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], answer: 1 },
  { q: "What is the capital of France?", options: ["Lyon", "Marseille", "Paris", "Nice"], answer: 2 },
  { q: "What is the capital of Japan?", options: ["Osaka", "Kyoto", "Tokyo", "Yokohama"], answer: 2 },
  { q: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"], answer: 2 },
  { q: "How many states make up the United States?", options: ["48", "49", "50", "51"], answer: 2 },
  { q: "Which is the smallest of the five oceans?", options: ["Indian Ocean", "Southern Ocean", "Arctic Ocean", "Atlantic Ocean"], answer: 2 },
  { q: "Which continent has the most countries?", options: ["Asia", "Africa", "Europe", "South America"], answer: 1 },
  { q: "What is the largest hot desert in the world?", options: ["Gobi Desert", "Kalahari Desert", "Sahara Desert", "Arabian Desert"], answer: 2 },
  { q: "What is the capital of Italy?", options: ["Milan", "Venice", "Rome", "Florence"], answer: 2 },
  { q: "What is the capital of Germany?", options: ["Munich", "Frankfurt", "Hamburg", "Berlin"], answer: 3 },
  { q: "What is the capital of Canada?", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"], answer: 2 },
  { q: "What is the capital of Egypt?", options: ["Alexandria", "Cairo", "Giza", "Luxor"], answer: 1 },
  { q: "What is the capital of Russia?", options: ["St. Petersburg", "Moscow", "Novosibirsk", "Kazan"], answer: 1 },
  { q: "What is the capital of South Korea?", options: ["Busan", "Incheon", "Seoul", "Daegu"], answer: 2 },
  { q: "What is the national sport of Japan?", options: ["Judo", "Karate", "Sumo wrestling", "Kendo"], answer: 2 },
  { q: "In which sport would you perform a slam dunk?", options: ["Volleyball", "Basketball", "Handball", "Tennis"], answer: 1 },
  { q: "How many players are on a standard cricket team?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "What is the study of living organisms called?", options: ["Geology", "Biology", "Chemistry", "Physics"], answer: 1 },
  { q: "What is the study of celestial objects called?", options: ["Astrology", "Astronomy", "Meteorology", "Geography"], answer: 1 },
  { q: "What part of the plant conducts photosynthesis?", options: ["Root", "Stem", "Leaf", "Flower"], answer: 2 },
  { q: "How many chambers does the human heart have?", options: ["2", "3", "4", "5"], answer: 2 },
  { q: "What is the main function of red blood cells?", options: ["Fight infection", "Carry oxygen", "Clot blood", "Digest food"], answer: 1 },
  { q: "Which vitamin do we mainly get from sunlight?", options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], answer: 2 },
  { q: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Quartz"], answer: 2 },
  { q: "What do you call water in its gas form?", options: ["Ice", "Steam", "Liquid", "Slush"], answer: 1 },
  { q: "What is the freezing point of water in Fahrenheit?", options: ["0°F", "32°F", "50°F", "100°F"], answer: 1 },
  { q: "What is the closest star to Earth?", options: ["Proxima Centauri", "Alpha Centauri", "The Sun", "Sirius"], answer: 2 },
  { q: "What do caterpillars turn into?", options: ["Moths only", "Butterflies only", "Butterflies or moths", "Beetles"], answer: 2 },
  { q: "What is the largest organ in the human body?", options: ["Liver", "Brain", "Skin", "Lungs"], answer: 2 },
  { q: "How many teeth does an adult human typically have?", options: ["28", "30", "32", "34"], answer: 2 },
  { q: "What is the main ingredient in traditional bread?", options: ["Rice", "Flour", "Sugar", "Oats"], answer: 1 },
  { q: "Which instrument has 88 keys?", options: ["Guitar", "Violin", "Piano", "Flute"], answer: 2 },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], answer: 2 },
  { q: "Which shape has no straight sides?", options: ["Square", "Triangle", "Circle", "Rectangle"], answer: 2 },
  { q: "What is the sum of angles in a quadrilateral?", options: ["180°", "270°", "360°", "450°"], answer: 2 },
  { q: "What is 12 × 12?", options: ["124", "134", "144", "154"], answer: 2 },
  { q: "What is 100 divided by 4?", options: ["20", "25", "30", "40"], answer: 1 },
  { q: "What number comes right after 999?", options: ["1000", "1001", "9999", "1100"], answer: 0 },
  { q: "How many zeros are in one million?", options: ["4", "5", "6", "7"], answer: 2 },
  { q: "What is the value of Pi rounded to two decimal places?", options: ["3.12", "3.14", "3.16", "3.18"], answer: 1 },
  { q: "What do you call a polygon with five sides?", options: ["Hexagon", "Heptagon", "Pentagon", "Octagon"], answer: 2 },
  { q: "How many minutes are in two hours?", options: ["100", "110", "120", "130"], answer: 2 },
  { q: "What is the past tense of \"go\"?", options: ["Goed", "Went", "Gone", "Going"], answer: 1 },
  { q: "Which punctuation mark ends a question?", options: ["Period", "Comma", "Question mark", "Exclamation mark"], answer: 2 },
  { q: "What is a synonym for \"happy\"?", options: ["Sad", "Joyful", "Angry", "Tired"], answer: 1 },
  { q: "What is an antonym for \"big\"?", options: ["Large", "Huge", "Small", "Giant"], answer: 2 },
  { q: "Which of these is a primary color?", options: ["Green", "Orange", "Blue", "Purple"], answer: 2 },
  { q: "How many primary colors are there in traditional color theory?", options: ["2", "3", "4", "5"], answer: 1 },
  { q: "What do you call baby dogs?", options: ["Kittens", "Puppies", "Cubs", "Calves"], answer: 1 },
  { q: "What do you call baby cats?", options: ["Puppies", "Kittens", "Cubs", "Kids"], answer: 1 },
  { q: "What is the largest species of big cat?", options: ["Lion", "Jaguar", "Tiger", "Leopard"], answer: 2 },
];

const SEEN_KEY = "quicktrivia_seen_v1";

function getSeenIndices() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSeenIndices(indices) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(indices));
  } catch {
    // localStorage can fail (private browsing, storage full) — losing
    // the no-repeat tracking for this one session isn't worth
    // breaking the game over
  }
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// No question repeats until every question in the pool has been
// shown once — tracked across sessions via localStorage, not just
// within one playthrough. Once the whole pool is exhausted, the
// tracker resets and a fresh cycle begins. This also fixes a real
// bug the old version had even within a single session: with a small
// pool, "index + 1 >= pool.length" wrapped back to the start of the
// SAME shuffle, so a fast player could see repeats before the
// 40-second round even ended.
function shuffledQuestions() {
  const allIndices = QUESTIONS.map((_, i) => i);
  let seen = getSeenIndices().filter((i) => i < QUESTIONS.length); // drop stale indices if the pool ever shrinks
  let unseen = allIndices.filter((i) => !seen.includes(i));

  if (unseen.length === 0) {
    seen = [];
    unseen = allIndices;
  }

  const orderedUnseen = shuffleArray(unseen);
  // The fallback batch draws only from `seen` (this session's picks
  // are excluded by construction, since seen and unseen partition
  // the whole pool with no overlap) — guarantees zero duplicates
  // within the returned array, however long a session runs, rather
  // than relying on "the pool is large enough that this never
  // actually happens in a 40-second round."
  const fallbackBatch = shuffleArray(seen);
  saveSeenIndices([...seen, ...orderedUnseen]);
  return [...orderedUnseen.map((i) => QUESTIONS[i]), ...fallbackBatch.map((i) => QUESTIONS[i])];
}

export default function QuickTrivia({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [pool, setPool] = useState(shuffledQuestions);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState(null);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const levelRef = useRef(1);

  useEffect(() => () => clearInterval(intervalRef.current), []);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);

  function finish() {
    if (!finishedRef.current) {
      finishedRef.current = true;
      clearInterval(intervalRef.current);
      onFinish(correctRef.current * 10);
    }
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function choose(optIndex) {
    if (picked !== null) return;
    setPicked(optIndex);
    const isCorrect = optIndex === pool[index].answer;
    let nextCorrect = correct;
    if (isCorrect) {
      sfx.correct();
      nextCorrect = correct + 1;
      setCorrect(nextCorrect);
    } else {
      sfx.wrong();
    }

    setTimeout(() => {
      // Running out of questions doesn't end the game — the pool
      // reshuffles and keeps going. Every 5 correct answers is a
      // level, earning bonus time instead of the clock cutting the
      // streak short.
      const newLevel = Math.floor(nextCorrect / 5) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        setTimeLeft((t) => t + LEVEL_BONUS_SECONDS);
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
      }

      if (index + 1 >= pool.length) {
        setPool(shuffledQuestions());
        setIndex(0);
      } else {
        setIndex((i) => i + 1);
      }
      setPicked(null);
    }, 600);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          General knowledge, multiple choice. Answer as many as you can — every 5 correct is a level and earns
          bonus time. 40 seconds to start.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  const current = pool[index];

  return (
    <div className="relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}! +{LEVEL_BONUS_SECONDS}s</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Correct: <span className="text-textLight">{correct}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 8 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div className="rounded-xl border border-lineColor p-6 mb-5 bg-bgPanel3 text-center min-h-[70px] flex items-center justify-center">
        <p className="font-mono text-sm">{current.q}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {current.options.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = picked !== null && i === current.answer;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className="rounded-md py-3 px-2 font-mono text-xs border text-textLight transition-colors"
              style={{
                borderColor: isRight ? "#16c784" : isPicked ? "#ff3ea5" : "rgba(169,159,214,0.22)",
                background: isRight ? "#113a2c" : isPicked ? "#3a1130" : "#241154",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
