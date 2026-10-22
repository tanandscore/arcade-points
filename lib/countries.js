// Flag emoji are built from the two-letter country code using Unicode
// "regional indicator" characters — no image files to host or upload.
// Renders natively on nearly all modern phones/browsers.
export function flagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const code = countryCode.toUpperCase();
  const points = [...code].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...points);
}

// A solid, practical list — not exhaustive ISO 3166, but covers the
// large majority of a global audience. Easy to extend later.
export const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "ID", name: "Indonesia" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "NP", name: "Nepal" },
  { code: "LK", name: "Sri Lanka" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "KE", name: "Kenya" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "PL", name: "Poland" },
  { code: "RU", name: "Russia" },
  { code: "TR", name: "Turkey" },
  { code: "AR", name: "Argentina" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
];

export function countryName(code) {
  return COUNTRIES.find((c) => c.code === code)?.name || null;
}
