import Link from "next/link";
import { TIERS } from "@/lib/catalog";

// The little tab row under the top bar, the same on the store home and the browse page:
//   Featured · Free · Power Pass · Legend Pass · Browse all
// `active` is one of "featured" | "free" | "power" | "legend" | "all". `home` is where "Featured" goes (the signed-in store
// home is /dashboard, the public one is /).
export default function StoreTabs({ active = "featured", home = "/" }) {
  const tabs = [
    { id: "featured", label: "Featured", href: home },
    { id: "free", label: TIERS.free.name, href: "/games?tier=free", color: TIERS.free.color },
    { id: "power", label: TIERS.power.name, href: "/games?tier=power", color: TIERS.power.color },
    { id: "legend", label: TIERS.legend.name, href: "/games?tier=legend", color: TIERS.legend.color },
    { id: "all", label: "Browse all", href: "/games" },
  ];
  return (
    <nav aria-label="Store sections" className="st-tabs">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className="st-tab" aria-current={active === t.id ? "page" : undefined} style={t.color ? { "--tc": t.color } : undefined}>
          {t.color && <i aria-hidden />}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
