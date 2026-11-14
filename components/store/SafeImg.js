"use client";

import { useEffect, useRef, useState } from "react";

// A picture that can never show a broken-image icon. If the file is missing or fails to load it renders `fallback` instead
// (nothing, unless the caller passes one), so a store tile always looks finished.
// Images that fail BEFORE the page finishes loading never fire React's error event, so on mount we also look at the picture
// itself: a finished download with no width is a failed one (a lazy image that has not started loading yet reports "not complete",
// so it is left alone).
export default function SafeImg({ fallback = null, alt = "", ...props }) {
  const [bad, setBad] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBad(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setBad(false); }, [props.src]);
  if (bad) return fallback;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} onError={() => setBad(true)} {...props} />;
}
