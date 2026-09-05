export default function AdminNav({ active }) {
  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/user-management", label: "User Management" },
    { href: "/admin/live-activity", label: "Live Activity" },
    { href: "/admin/game-testing", label: "Game Testing" },
    { href: "/admin/tournaments", label: "Tournaments" },
    { href: "/admin/changelog", label: "Changelog" },
    { href: "/admin/errors", label: "Errors" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="font-mono text-[10px] px-3 py-1.5 rounded-md border"
          style={
            l.href === active
              ? { borderColor: "#3ee6e0", color: "#3ee6e0" }
              : { borderColor: "rgba(169,159,214,0.3)", color: "#a99fd6" }
          }
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}
