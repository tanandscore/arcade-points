import { flagEmoji } from "@/lib/countries";

export default function CountryTag({ code }) {
  if (!code) return null;
  return (
    <span className="mr-1.5" title={code}>
      {flagEmoji(code)}
    </span>
  );
}
