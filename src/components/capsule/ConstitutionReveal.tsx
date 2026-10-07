"use client";

import { useEffect, useMemo, useState } from "react";
import { articleLabel, type CapsuleConstitution, type CapsuleCrew } from "@/lib/capsule/types";
import { otherLanguageTitle } from "./ConstitutionDoc";
import FitBox from "./FitBox";

/**
 * The constitution on the big screen, one big page at a time (a lawn full of people can't read a full page):
 * the title and preamble, one page per article, then the closing line over every crew's group selfie.
 * Advances by itself; ←/→/PageUp/PageDown/Space (a presentation clicker) also work.
 */

type Page = { kind: "intro" } | { kind: "article"; index: number } | { kind: "close" };

/** Fewest columns that keep every 4:3 tile inside `maxH` (the page also holds the closing line). */
function mosaicCols(n: number, width = 1720, maxH = 540, gap = 8): number {
  for (let c = 1; c <= 14; c++) {
    const w = (width - gap * (c - 1)) / c;
    const rows = Math.ceil(n / c);
    if (rows * w * 0.75 + gap * (rows - 1) <= maxH) return c;
  }
  return 14;
}

const wordCount = (...parts: (string | undefined)[]) =>
  parts.join(" ").trim().split(/\s+/).filter(Boolean).length;

export default function ConstitutionReveal({
  constitution: c,
  crews,
  active,
}: {
  constitution: CapsuleConstitution;
  crews: CapsuleCrew[];
  active: boolean;
}) {
  const pages = useMemo<Page[]>(
    () => [{ kind: "intro" }, ...c.articles.map((_, index) => ({ kind: "article" as const, index })), { kind: "close" }],
    [c]
  );
  const [p, setP] = useState(0);
  const last = pages.length - 1;
  const dir = c.language === "ar" ? "rtl" : "ltr";

  // Start from the top whenever the view opens or a new constitution arrives.
  useEffect(() => {
    if (active) setP(0);
  }, [active, c.generatedAt]);

  const page = pages[Math.min(p, last)];

  // Reading time grows with the amount of text on the page.
  useEffect(() => {
    if (!active || p >= last) return;
    const words =
      page.kind === "intro"
        ? wordCount(c.title, c.preamble)
        : page.kind === "article"
          ? wordCount(...c.articles[page.index].clauses)
          : 0;
    const t = window.setTimeout(() => setP((x) => Math.min(x + 1, last)), Math.min(24000, 7000 + words * 330));
    return () => window.clearTimeout(t);
  }, [active, p, last, page, c]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        setP((x) => Math.min(x + 1, last));
        e.preventDefault();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        setP((x) => Math.max(x - 1, 0));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, last]);

  return (
    <>
      <div className="cap-reveal" dir={dir}>
        <FitBox key={p} max={page.kind === "close" ? 52 : 50} min={26} watch={`${p}:${c.generatedAt}`} className="cap-pg cap-fadein">
          {page.kind === "intro" && (
            <>
              {c.sample && <span className="cap-sample inv">Sample constitution · the AI was not available</span>}
              <h1>{c.title}</h1>
              <p className="sub" dir={c.language === "ar" ? "ltr" : "rtl"}>
                {otherLanguageTitle(c)}
              </p>
              <p>{c.preamble}</p>
            </>
          )}
          {page.kind === "article" && (
            <>
              <div className="art">{articleLabel(page.index + 1, c.language)}</div>
              <h2>{c.articles[page.index].heading}</h2>
              <ul>
                {c.articles[page.index].clauses.map((clause, i) => (
                  <li key={i}>{clause}</li>
                ))}
              </ul>
            </>
          )}
          {page.kind === "close" && (
            <>
              <p className="close">{c.closing}</p>
              <p className="sign">{c.signOff}</p>
              <div className="mosaic" style={{ gridTemplateColumns: `repeat(${mosaicCols(Math.min(crews.length, 40))}, 1fr)` }}>
                {crews.slice(0, 40).map((crew) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={crew.id} src={crew.photo} alt="" />
                ))}
              </div>
            </>
          )}
        </FitBox>
      </div>
      <div className="cap-dots" dir="ltr" aria-label="Constitution pages">
        {pages.map((_, i) => (
          <button key={i} className={i === p ? "on" : ""} onClick={() => setP(i)} aria-label={`Page ${i + 1}`} />
        ))}
        <span>
          Constitution · {p + 1} / {pages.length}
        </span>
      </div>
    </>
  );
}
