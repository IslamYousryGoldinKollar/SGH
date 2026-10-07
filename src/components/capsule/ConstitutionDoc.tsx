"use client";

import { articleLabel, type CapsuleConstitution } from "@/lib/capsule/types";

/** The title of the other language, shown as a quiet subtitle (the audience reads both). */
export const otherLanguageTitle = (c: CapsuleConstitution) =>
  c.language === "ar" ? "The One Island Constitution" : "دستور الجزيرة الواحدة";

/** The constitution, typeset as a document. Em-based sizes so the parent decides the scale. */
export function ConstitutionDoc({ constitution: c, style }: { constitution: CapsuleConstitution; style?: React.CSSProperties }) {
  const dir = c.language === "ar" ? "rtl" : "ltr";
  return (
    <div className="cap-doc" dir={dir} style={style}>
      {c.sample && <span className="cap-sample">Sample constitution · the AI was not available</span>}
      <h1>{c.title}</h1>
      <p className="sub" dir={c.language === "ar" ? "ltr" : "rtl"}>
        {otherLanguageTitle(c)}
      </p>
      <p className="open">{c.preamble}</p>
      {c.articles.map((a, i) => (
        <section key={i}>
          <h2>
            <small>{articleLabel(i + 1, c.language)}</small>
            {a.heading}
          </h2>
          <ul>
            {a.clauses.map((clause, j) => (
              <li key={j}>{clause}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="close">{c.closing}</p>
      <p className="sign">{c.signOff}</p>
    </div>
  );
}
