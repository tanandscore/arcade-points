"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "@/components/store/Icons";

// "On this page" list for the long legal pages (Terms, Privacy).
//   Desktop: a sticky list beside the text that lights up the section you are reading.
//   Phone / tablet: a closed box above the text that opens to the same list.
// items = [[sectionId, label], ...]. The ids are the ids of the sections on the page, so /privacy#rights still works as a plain link.
export default function LegalToc({ items }) {
  const [active, setActive] = useState(items[0]?.[0] || "");

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = items[0]?.[0] || "";
      for (const [id] of items) {
        const el = document.getElementById(id);
        // the section being read is the last one whose top edge has scrolled up past the sticky top bar
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      // a short last section can never reach the top of the screen, so at the very bottom of the page it counts as being read
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && items.length) {
        current = items[items.length - 1][0];
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return (
    <>
      {/* phone and tablet */}
      <details className="group lg:hidden st-band mt-8">
        <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 py-3 text-[14.5px] font-semibold text-[#f5f0ff] [&::-webkit-details-marker]:hidden">
          On this page
          <span className="text-[#c3bbea] transition-transform group-open:rotate-180"><ChevronDown /></span>
        </summary>
        <ul className="grid sm:grid-cols-2 gap-x-6 px-4 pb-3 text-[14.5px]">
          {items.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                className="block py-2 text-[#c3bbea] hover:text-white"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </details>

      {/* desktop */}
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-[88px]">
          <p className="mb-3 text-[13px] font-semibold text-[#a99fd6]">On this page</p>
          <ul className="border-l border-white/10">
            {items.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? "location" : undefined}
                  className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-[14px] leading-snug text-[#c3bbea] transition-colors hover:text-white aria-[current=location]:border-[#3ee6e0] aria-[current=location]:font-semibold aria-[current=location]:text-white"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
