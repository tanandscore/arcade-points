"use client";

import { useEffect, useRef, useState } from "react";
import { createRadioPlayer } from "@/midnightburn/engine/radio";
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
  const [st, setSt] = useState(null);
  useEffect(() => {
    const m = createRadioPlayer();
    musicRef.current = m; setMusicOn(m.isEnabled()); setSt(m.station());
    const off = m.onChange((s) => setSt(s));
    return () => { off(); m.stop(); musicRef.current = null; };
  }, []);
  const kick = () => { musicRef.current && musicRef.current.isEnabled() && musicRef.current.start(); };
  const btn = "font-mono text-[10px] px-2.5 py-1 rounded-md border border-lineColor text-textDim hover:text-textLight";
  return (
    <div onPointerDownCapture={kick} onKeyDownCapture={kick} className="relative">
      <div className="flex justify-end items-center gap-1.5 mb-1">
        <span className="font-mono text-[10px] text-textDim mr-1">{st ? `${st.name} · ${st.tag}` : ""}</span>
        <button onClick={() => musicRef.current && musicRef.current.prev()} className={btn} title="Previous station">◂</button>
        <button onClick={() => musicRef.current && musicRef.current.next()} className={btn} title="Next station (N in game)">▸</button>
        <button
          onClick={() => { const m = musicRef.current; if (!m) return; const on = !m.isEnabled(); m.setEnabled(on); setMusicOn(on); }}
          className={btn} title="Radio on / off"
        >{musicOn ? "♪ RADIO ON" : "♪ RADIO OFF"}</button>
      </div>
      <MidnightBurnCity {...props} musicRef={musicRef} onMood={(v) => musicRef.current && musicRef.current.setIntensity(v)} />
    </div>
  );
}
