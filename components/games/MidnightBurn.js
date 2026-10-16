"use client";

import { useEffect, useRef, useState } from "react";
import { createMusicPlayer } from "@/lib/midnightBurn/music";
import MidnightBurnCity from "./MidnightBurnCity";
import MidnightBurnClassic from "./MidnightBurnClassic";

// Midnight Burn: the open-world Mumbai night city by default, with the original six-circuit mode kept as an option.
// The classic mode brings its own soundtrack, so the wrapper only runs music for the city.
export default function MidnightBurn(props) {
  const [mode, setMode] = useState("city");
  if (mode === "classic") {
    return (
      <div>
        <div className="flex justify-start mb-1">
          <button onClick={() => setMode("city")} className="font-mono text-[10px] px-2.5 py-1 rounded-md border border-lineColor text-textDim hover:text-textLight">◂ BACK TO THE CITY</button>
        </div>
        <MidnightBurnClassic {...props} />
      </div>
    );
  }
  return <CityWithMusic {...props} onClassic={() => setMode("classic")} />;
}

function CityWithMusic(props) {
  const musicRef = useRef(null);
  const [musicOn, setMusicOn] = useState(true);
  useEffect(() => {
    const m = createMusicPlayer();
    musicRef.current = m; setMusicOn(m.isEnabled());
    return () => { m.stop(); musicRef.current = null; };
  }, []);
  const kick = () => { musicRef.current && musicRef.current.isEnabled() && musicRef.current.start(); };
  return (
    <div onPointerDownCapture={kick} onKeyDownCapture={kick} className="relative">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => { const m = musicRef.current; if (!m) return; const on = !m.isEnabled(); m.setEnabled(on); setMusicOn(on); }}
          className="font-mono text-[10px] px-2.5 py-1 rounded-md border border-lineColor text-textDim hover:text-textLight"
          title="Soundtrack on / off"
        >{musicOn ? "♪ SOUNDTRACK ON" : "♪ SOUNDTRACK OFF"}</button>
      </div>
      <MidnightBurnCity {...props} onMood={(v) => musicRef.current && musicRef.current.setIntensity(v)} />
    </div>
  );
}
