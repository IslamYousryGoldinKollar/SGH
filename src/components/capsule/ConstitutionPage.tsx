"use client";

import { Printer } from "lucide-react";
import { useCapsuleCrews, useCapsuleSession, useCapsuleStore } from "@/hooks/useCapsule";
import BrandMark from "./BrandMark";
import { ConstitutionDoc } from "./ConstitutionDoc";

/** A normal, printable page with the finished constitution and every crew that signed it. */
export default function ConstitutionPage({ sessionId }: { sessionId: string }) {
  const store = useCapsuleStore(sessionId);
  const { data: session, loading } = useCapsuleSession(store);
  const { data: crews } = useCapsuleCrews(store);

  if (loading) {
    return (
      <div className="cap-paper-page" style={{ display: "grid", placeItems: "center" }}>
        <div className="cap-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  const constitution = session?.constitution;
  return (
    <div className="cap-paper-page">
      <div className="cap-paper-tools">
        {constitution && (
          <button className="cap-btn" onClick={() => window.print()}>
            <Printer aria-hidden /> Print or save as PDF
          </button>
        )}
      </div>
      <article className="cap-paper">
        <div className="brand">
          <BrandMark size={40} />
          The One Island · Team Building 2026
        </div>
        {constitution ? (
          <>
            <ConstitutionDoc constitution={constitution} />
            {crews.length > 0 && (
              <div className="photos">
                <p>Signed by {constitution.crewCount} crews</p>
                <div>
                  {crews.map((c) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.id} src={c.photo} alt={`${c.crewName || c.leaderName}'s crew`} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="cap-doc">
            <h1>The constitution is not written yet</h1>
            <p className="open">Once the host asks the AI to draft it from the crews&apos; answers, it will appear here.</p>
          </div>
        )}
      </article>
    </div>
  );
}
