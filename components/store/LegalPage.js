import Navbar from "@/components/Navbar";
import LegalToc from "@/components/store/LegalToc";
import { getViewer } from "@/lib/viewer";

// Upgrade 70: one shared frame for the legal and info pages (About, Contact, Terms, Privacy, Refunds), so they look like the rest
// of the store: the same top bar (and phone tab bar), a big plain title, calm reading text, and, on the long pages, an
// "On this page" list. The wording of each page stays in that page's own file; this file only decides how it looks.
//
//   title    page title                       lead     the sentence(s) under the title (text or markup)
//   updated  e.g. "23 October 2026" (optional) toc      [[sectionId, label], ...] for the "On this page" list (optional)
export default async function LegalPage({ title, lead, updated, toc, children }) {
  // These pages must always open, even if looking up who is signed in fails.
  let v = { username: null, points: 0, isAdmin: false };
  try { v = await getViewer(); } catch { /* show the page as for a visitor */ }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <Navbar username={v.username} points={v.points} isAdmin={v.isAdmin} />
      <main className="st-container pt-9 pb-16">
        <header className="max-w-3xl">
          <h1 className="st-h1" style={{ fontSize: "clamp(2rem, 4.2vw, 2.9rem)" }}>{title}</h1>
          {lead && <div className="st-muted mt-3 text-[16px] leading-relaxed">{lead}</div>}
          {updated && <p className="mt-3 text-[13.5px] text-[#a99fd6]">Last updated {updated}</p>}
        </header>

        {toc ? (
          <div className="lg:mt-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
            <LegalToc items={toc} />
            <div className="st-doc mt-9 lg:mt-0 max-w-[46rem]">{children}</div>
          </div>
        ) : (
          <div className="st-doc mt-9 max-w-[46rem]">{children}</div>
        )}
      </main>
    </div>
  );
}

// One section of a legal page. The id is the link target (/privacy#rights); the hairline above every section but the first
// is what separates them, so there are no loud coloured headings.
export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/10 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0">
      <h2 className="st-h2">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
