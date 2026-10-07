"use client";

import type { CapsuleLetter } from "@/lib/capsule/types";

/** The letter, typeset. Em-based sizes so the parent decides the scale. */
export function LetterDoc({ letter, style }: { letter: CapsuleLetter; style?: React.CSSProperties }) {
  const dir = letter.language === "ar" ? "rtl" : "ltr";
  return (
    <div className="cap-doc" dir={dir} style={style}>
      {letter.sample && <span className="cap-sample">Sample letter · the AI was not available</span>}
      <h1>{letter.title}</h1>
      <p className="sal">{letter.salutation}</p>
      <p className="open">{letter.opening}</p>
      {letter.sections.map((s, i) => (
        <section key={i}>
          <h2>
            <span>{i + 1}</span>
            {s.heading}
          </h2>
          <p>{s.body}</p>
          {s.bullets && s.bullets.length > 0 && (
            <ul>
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="close">{letter.closing}</p>
      <p className="sign">{letter.signOff}</p>
    </div>
  );
}
