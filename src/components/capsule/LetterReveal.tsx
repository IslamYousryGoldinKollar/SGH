"use client";

import { useEffect, useMemo, useState } from "react";
import type { CapsuleCrew, CapsuleLetter } from "@/lib/capsule/types";
import FitBox from "./FitBox";

/**
 * The letter on the big screen, one big page at a time (a lawn full of people can't read a full page):
 * intro, the three sections, then the closing line over every crew's group selfie.
 * Advances by itself; ←/→/PageUp/PageDown/Space (a presentation clicker) also work.
 */

type Page = { kind: "intro" } | { kind: "section"; index: number } | { kind: "close" };

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

export default function LetterReveal({
  letter,
  crews,
  active,
}: {
  letter: CapsuleLetter;
  crews: CapsuleCrew[];
  active: boolean;
}) {
  const pages = useMemo<Page[]>(
    () => [{ kind: "intro" }, ...letter.sections.map((_, index) => ({ kind: "section" as const, index })), { kind: "close" }],
    [letter]
  );
  const [p, setP] = useState(0);
  const last = pages.length - 1;
  const dir = letter.language === "ar" ? "rtl" : "ltr";

  // Start from the top whenever the view opens or a new letter arrives.
  useEffect(() => {
    if (active) setP(0);
  }, [active, letter.generatedAt]);

  const page = pages[Math.min(p, last)];

  // Reading time grows with the amount of text on the page.
  useEffect(() => {
    if (!active || p >= last) return;
    const words =
      page.kind === "intro"
        ? wordCount(letter.title, letter.salutation, letter.opening)
        : page.kind === "section"
          ? wordCount(letter.sections[page.index].body, ...(letter.sections[page.index].bullets ?? []))
          : 0;
    const t = window.setTimeout(() => setP((x) => Math.min(x + 1, last)), Math.min(26000, 7000 + words * 330));
    return () => window.clearTimeout(t);
  }, [active, p, last, page, letter]);

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
        <FitBox key={p} max={page.kind === "close" ? 52 : 50} min={26} watch={`${p}:${letter.generatedAt}`} className="cap-pg cap-fadein">
          {page.kind === "intro" && (
            <>
              {letter.sample && <span className="cap-sample inv">Sample letter · the AI was not available</span>}
              <h1>{letter.title}</h1>
              <p className="sal">{letter.salutation}</p>
              <p>{letter.opening}</p>
            </>
          )}
          {page.kind === "section" && (
            <>
              <h2>
                <span>{page.index + 1}</span>
                {letter.sections[page.index].heading}
              </h2>
              <p>{letter.sections[page.index].body}</p>
              {letter.sections[page.index].bullets && (
                <ul>
                  {letter.sections[page.index].bullets!.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {page.kind === "close" && (
            <>
              <p className="close">{letter.closing}</p>
              <p className="sign">{letter.signOff}</p>
              <div className="mosaic" style={{ gridTemplateColumns: `repeat(${mosaicCols(Math.min(crews.length, 40))}, 1fr)` }}>
                {crews.slice(0, 40).map((c) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c.id} src={c.photo} alt="" />
                ))}
              </div>
            </>
          )}
        </FitBox>
      </div>
      <div className="cap-dots" dir="ltr" aria-label="Letter pages">
        {pages.map((_, i) => (
          <button key={i} className={i === p ? "on" : ""} onClick={() => setP(i)} aria-label={`Page ${i + 1}`} />
        ))}
        <span>
          Letter · {p + 1} / {pages.length}
        </span>
      </div>
    </>
  );
}
