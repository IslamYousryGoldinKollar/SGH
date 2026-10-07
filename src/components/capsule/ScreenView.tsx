"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { groupThemesAction, writeConstitutionAction } from "@/lib/capsule-actions";
import { useCapsuleCrews, useCapsuleSession, useCapsuleStore } from "@/hooks/useCapsule";
import { useIdle, useStageScale } from "@/hooks/useStage";
import { SAMPLE_CONSTITUTION, SAMPLE_THEMES } from "@/lib/capsule/demo-data";
import {
  DEFAULT_QUESTIONS,
  ARTICLE_TITLES,
  type CapsuleCrew,
  type CapsuleSession,
  type OutputLanguage,
} from "@/lib/capsule/types";
import BrandMark from "./BrandMark";
import ConstitutionReveal from "./ConstitutionReveal";
import QRBox from "./QRBox";

/**
 * The big screen. One fixed 1920×1080 stage, scaled to fit the projector.
 *
 *   scan   – a giant QR code (crews arriving)
 *   wall   – live crew spotlight + every group selfie so far (default once the first crew is in)
 *   themes – what the AI found when it grouped the answers
 *   constitution – the One Island constitution, drafted by the AI from every crew's answers
 *
 * The presenter toolbar only renders for the session owner (or in /capsule/demo) and fades when idle.
 */

type View = "scan" | "wall" | "themes" | "constitution";
type Mode = "auto" | View;

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "scan", label: "QR", key: "1" },
  { id: "wall", label: "Wall", key: "2" },
  { id: "themes", label: "Themes", key: "3" },
  { id: "constitution", label: "Constitution", key: "4" },
];

export default function ScreenView({ sessionId }: { sessionId: string }) {
  const store = useCapsuleStore(sessionId);
  const { data: session, loading: sessionLoading, error: sessionError } = useCapsuleSession(store);
  const { data: crews, loading: crewsLoading } = useCapsuleCrews(store);
  const [user] = useAuthState(auth);
  const scale = useStageScale();
  const idle = useIdle(3500);

  const [joinUrl, setJoinUrl] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [lang, setLang] = useState<OutputLanguage>("en");
  const [busy, setBusy] = useState<null | "themes" | "constitution">(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/capsule/${sessionId.toUpperCase()}`);
  }, [sessionId]);

  const n = crews.length;
  const expected = session?.expectedCrews ?? 25;
  const isAdmin = store.isDemo || (!!user && !!session && session.adminId === user.uid);
  const view: View = mode !== "auto" ? mode : session?.constitution ? "constitution" : n === 0 ? "scan" : "wall";

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 7000);
  }, []);

  // ------------------------------------------------------------ spotlight
  const [idx, setIdx] = useState(0);
  const [pin, setPin] = useState(0);
  const [freshId, setFreshId] = useState<string | null>(null);
  const seen = useRef<number | null>(null);
  const crewsRef = useRef(crews);
  crewsRef.current = crews;

  // Keyed on the count only: Firestore re-emits the same crews (e.g. when a server timestamp is
  // confirmed) and that must not restart or cancel the "NEW" badge.
  useEffect(() => {
    if (crewsLoading) return;
    if (seen.current === null) {
      seen.current = n;
      if (n) setIdx(n - 1);
      return;
    }
    if (n > seen.current) {
      // A crew just landed: jump to it and let it shine.
      const newest = crewsRef.current[n - 1];
      setIdx(n - 1);
      setPin((p) => p + 1);
      setFreshId(newest.id);
      window.setTimeout(() => setFreshId((cur) => (cur === newest.id ? null : cur)), 12000);
    }
    seen.current = n;
  }, [n, crewsLoading]);

  useEffect(() => {
    if (n < 2) return;
    const t = window.setInterval(() => setIdx((i) => (Math.min(i, n - 1) + 1) % n), 9000);
    return () => window.clearInterval(t);
  }, [n, pin]);

  const spotIdx = n ? Math.min(idx, n - 1) : 0;
  const spot: CapsuleCrew | undefined = crews[spotIdx];

  // ------------------------------------------------------------ AI + admin actions
  const payload = useMemo(
    () => ({
      questions: session?.questions ?? DEFAULT_QUESTIONS,
      language: lang,
      crews: crews.map((c) => ({ crewName: c.crewName, leaderName: c.leaderName, answers: c.answers })),
    }),
    [session?.questions, lang, crews]
  );

  async function analyse() {
    if (busy || n === 0) return;
    setBusy("themes");
    try {
      const res = await groupThemesAction(payload);
      if (res.ok) {
        await store.saveThemes(res.data);
        setMode("themes");
      } else if (store.isDemo) {
        await store.saveThemes({ ...SAMPLE_THEMES, generatedAt: Date.now(), crewCount: n });
        setMode("themes");
        showToast(`${res.error} Showing sample themes.`);
      } else {
        showToast(res.error);
      }
    } catch (e) {
      console.error(e);
      showToast("Could not save the themes. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function draftConstitution() {
    if (busy || n === 0) return;
    if (session?.constitution && !window.confirm("Draft a new constitution? The current one will be replaced.")) return;
    setBusy("constitution");
    setMode("constitution");
    try {
      const res = await writeConstitutionAction(payload);
      if (res.ok) {
        await store.saveConstitution(res.data);
      } else if (store.isDemo) {
        await store.saveConstitution({ ...SAMPLE_CONSTITUTION, generatedAt: Date.now(), crewCount: n });
        showToast(`${res.error} Showing a sample constitution.`);
      } else {
        showToast(res.error);
        setMode("auto");
      }
    } catch (e) {
      console.error(e);
      showToast("Could not save the constitution. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus() {
    if (!session) return;
    try {
      await store.setStatus(session.status === "open" ? "closed" : "open");
    } catch {
      showToast("Could not change the status.");
    }
  }

  async function removeSpotlight() {
    if (!spot) return;
    if (!window.confirm(`Remove "${spot.crewName || spot.leaderName}" from the wall?`)) return;
    try {
      await store.deleteCrew(spot.id);
    } catch {
      showToast("Could not remove this crew.");
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  // Presenter shortcuts: 1-4 views, A auto, F fullscreen.
  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) setMode(v.id);
      else if (e.key === "a" || e.key === "A") setMode("auto");
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  // ------------------------------------------------------------ states
  if (sessionLoading) {
    return (
      <div className="cap-screen" style={{ display: "grid", placeItems: "center", color: "#fff" }}>
        <div className="cap-spin" role="status" aria-label="Connecting" />
      </div>
    );
  }
  if (sessionError || !session) {
    return (
      <div className="cap-screen" style={{ display: "grid", placeItems: "center", color: "#fff", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 700 }}>We can&apos;t open this capsule</h1>
          <p style={{ marginTop: 12, fontSize: 20, opacity: 0.8 }}>
            {sessionError ? "The server could not be reached or this screen is not allowed to read it." : `No capsule with the code ${sessionId.toUpperCase()}.`}
          </p>
        </div>
      </div>
    );
  }

  const labelFor = (i: number) =>
    session.questions[i] === DEFAULT_QUESTIONS[i] ? ARTICLE_TITLES[i] : `Question ${i + 1}`;
  const on = (v: View) => (view === v ? "on" : "");

  return (
    <div className="cap-screen">
      <div
        className="cap-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        data-view={view}
      >
        {/* ---------------------------------------------------------- scan */}
        <section className={`cap-view red ${on("scan")}`} aria-hidden={view !== "scan"}>
          <Header n={n} expected={expected} session={session} />
          <div className="cap-scan">
            <div className="cap-qrbox">
              <QRBox value={joinUrl} size={672} />
              <div className="corner" />
            </div>
            <div>
              <div className="big">
                Scan once.
                <br />
                Write as one.
              </div>
              <p className="lead">
                Crew leaders only: one scan per crew of 8. Read each question out loud, agree together, then take your group selfie. You are drafting the constitution of The One Island.
              </p>
              <div className="qs">
                {session.questions.map((q, i) => (
                  <div key={i}>
                    <b>{i + 1}</b>
                    {q}
                  </div>
                ))}
              </div>
              <div className="cap-url">{joinUrl.replace(/^https?:\/\//, "")}</div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- wall */}
        <section className={`cap-view paper ${on("wall")}`} aria-hidden={view !== "wall"}>
          <Header n={n} expected={expected} session={session} />
          {spot ? (
            <Spotlight crew={spot} index={spotIdx} fresh={freshId === spot.id} labelFor={labelFor} />
          ) : (
            <div className="cap-empty">Waiting for the first crew…</div>
          )}
          <aside className="cap-side">
            <b>Add your crew</b>
            <div className="qr">
              <QRBox value={joinUrl} size={300} />
            </div>
            <small>Leader scans once, then the crew answers together.</small>
            <div className="lbl">
              {n} of {expected} crews are in
            </div>
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (n / Math.max(1, expected)) * 100)}%` }} />
            </div>
          </aside>
          <Strip crews={crews} expected={expected} activeIndex={spotIdx} onPick={(i) => { setIdx(i); setPin((p) => p + 1); }} />
        </section>

        {/* ---------------------------------------------------------- themes */}
        <section className={`cap-view paper ${on("themes")}`} aria-hidden={view !== "themes"}>
          <Header n={n} expected={expected} session={session} />
          <div className="cap-title">
            {session.themes ? `What ${session.themes.crewCount} crews wrote` : "What the crews wrote"}
            <small>
              {session.themes
                ? `Grouped by AI, in the crews' own words${session.themes.crewCount < n ? ` · based on the first ${session.themes.crewCount} of ${n} crews` : ""}`
                : "Themes appear here once the AI has grouped the answers"}
            </small>
          </div>
          {session.themes ? (
            <div className="cap-cols" dir={session.themes.language === "ar" ? "rtl" : "ltr"} style={{ gridTemplateColumns: `repeat(${session.themes.byQuestion.length}, 1fr)` }}>
              {session.themes.byQuestion.map((items, qi) => (
                <div className="cap-col" key={qi}>
                  <h3>{labelFor(qi)}</h3>
                  <div className="qtxt">{session.questions[qi]}</div>
                  {items.slice(0, 4).map((t, ti) => (
                    <div className="cap-theme" key={ti}>
                      <div className="row">
                        <span>{t.theme}</span>
                        <em>{t.crews} {t.crews === 1 ? "crew" : "crews"}</em>
                      </div>
                      <div className="meter">
                        <i style={{ width: `${Math.min(100, (t.crews / Math.max(1, session.themes!.crewCount)) * 100)}%` }} />
                      </div>
                      {ti === 0 && t.quote && <q dir="auto">{t.quote}</q>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="cap-empty" style={{ top: 200 }}>
              {isAdmin ? "Press “Group answers” in the toolbar" : "Coming soon"}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- constitution */}
        <section className={`cap-view blue ${on("constitution")}`} aria-hidden={view !== "constitution"}>
          <Header n={n} expected={expected} session={session} />
          {session.constitution && busy !== "constitution" ? (
            <ConstitutionReveal constitution={session.constitution} crews={crews} active={view === "constitution"} />
          ) : (
            <div className="cap-wait">
              {busy === "constitution" ? (
                <>
                  <div className="cap-spin" style={{ margin: "0 auto", borderColor: "rgba(255,255,255,.25)", borderTopColor: "#fff", width: 64, height: 64 }} />
                  <div className="big">Drafting the constitution…</div>
                  <p>Reading {n} crews&apos; answers</p>
                </>
              ) : (
                <>
                  <div className="big">The constitution is not drafted yet</div>
                  <p>{isAdmin ? "Press “Draft constitution” in the toolbar" : "Coming soon"}</p>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ---------------------------------------------------------- presenter toolbar */}
      {isAdmin && (
        <div className={`cap-bar ${idle && !busy ? "idle" : ""}`} role="toolbar" aria-label="Presenter controls">
          <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")} title="Automatic: QR, then the wall, then the constitution (A)">
            Auto
          </button>
          {VIEWS.map((v) => (
            <button key={v.id} className={mode === v.id ? "on" : ""} onClick={() => setMode(v.id)} title={`Show ${v.label} (${v.key})`}>
              {v.label}
            </button>
          ))}
          <span className="sep" />
          <button onClick={analyse} disabled={!!busy || n === 0}>
            {busy === "themes" ? "Grouping…" : "Group answers"}
          </button>
          <button onClick={draftConstitution} disabled={!!busy || n === 0}>
            {busy === "constitution" ? "Drafting…" : session.constitution ? "Redraft constitution" : "Draft constitution"}
          </button>
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} title="Language of the next constitution and themes">
            {lang === "en" ? "EN" : "عربي"}
          </button>
          <span className="sep" />
          <button onClick={toggleStatus}>{session.status === "open" ? "Close submissions" : "Reopen"}</button>
          {view === "wall" && n > 0 && <button onClick={removeSpotlight}>Remove crew</button>}
          {store.isDemo && (
            <>
              <button onClick={() => void store.addSampleCrew?.()}>+ Sample crew</button>
              <button
                onClick={() => {
                  if (window.confirm("Reset the demo? This clears every sample crew and the constitution.")) void store.resetDemo?.();
                }}
              >
                Reset
              </button>
            </>
          )}
          <a
            href={`/capsule/${sessionId.toUpperCase()}/constitution`}
            target="_blank"
            rel="noreferrer"
            style={{ all: "unset", cursor: "pointer", whiteSpace: "nowrap", height: 38, padding: "0 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "rgba(255,255,255,.12)", display: "inline-flex", alignItems: "center" }}
          >
            Constitution page ↗
          </a>
          <button onClick={toggleFullscreen} title="Fullscreen (F)">
            Fullscreen
          </button>
        </div>
      )}
      {toast && (
        <div className="cap-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Header({ n, expected, session }: { n: number; expected: number; session: CapsuleSession }) {
  return (
    <header className="cap-sh">
      <BrandMark size={64} ring="var(--mark-ring)" dot="var(--mark-dot)" />
      <div>
        <div className="ttl">The One Island Constitution</div>
        <div className="sub">Drafted live by the crews of etisalat · The Culture Capsule</div>
      </div>
      <div className="right">
        <div className="cap-tally">
          <b>{n}</b>
          <span>/ {expected} crews</span>
        </div>
        <span className={`cap-live ${session.status === "closed" ? "closed" : ""}`}>
          {session.status === "closed" ? "CLOSED" : "LIVE"}
        </span>
      </div>
    </header>
  );
}

function Spotlight({
  crew,
  index,
  fresh,
  labelFor,
}: {
  crew: CapsuleCrew;
  index: number;
  fresh: boolean;
  labelFor: (i: number) => string;
}) {
  const total = crew.answers.join("").length;
  const tier = total <= 160 ? "t1" : total <= 340 ? "t2" : total <= 560 ? "t3" : "t4";
  return (
    <article key={crew.id} className={`cap-spot ${tier} enter`}>
      <div className="ph">
        <div className="blur" style={{ backgroundImage: `url("${crew.photo}")` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crew.photo} alt={`Group selfie of ${crew.crewName || crew.leaderName}'s crew`} />
        {fresh && <span className="cap-new">NEW</span>}
      </div>
      <div className="tx">
        <div className="nm" dir="auto">
          {crew.crewName || `${crew.leaderName}'s crew`}
        </div>
        <div className="by">
          Led by {crew.leaderName} · Crew {index + 1}
        </div>
        <div className="qa">
          {crew.answers.map((_, i) => (
            <div key={i}>
              <small>{labelFor(i)}</small>
              <p dir="auto">{crew.answers[i]}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/** Every group selfie so far, plus dashed slots for the crews still to come. */
function Strip({
  crews,
  expected,
  activeIndex,
  onPick,
}: {
  crews: CapsuleCrew[];
  expected: number;
  activeIndex: number;
  onPick: (i: number) => void;
}) {
  const total = Math.max(crews.length, expected);
  // Largest tile height that still fits `total` tiles in the 190px strip.
  let h = 50;
  for (const candidate of [150, 125, 100, 84, 70, 60, 50]) {
    const rows = Math.floor((190 + 12) / (candidate + 12));
    const perRow = Math.floor((1720 + 12) / ((candidate * 4) / 3 + 12));
    if (rows * perRow >= total) {
      h = candidate;
      break;
    }
  }
  const w = Math.round((h * 4) / 3);
  return (
    <div className="cap-strip" aria-label="All crews">
      {Array.from({ length: total }, (_, i) => {
        const c = crews[i];
        return c ? (
          <button
            key={c.id}
            className={`cap-thumb ${i === activeIndex ? "on" : ""}`}
            style={{ width: w, height: h }}
            onClick={() => onPick(i)}
            aria-label={`Show ${c.crewName || c.leaderName}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.photo} alt="" />
            {h >= 84 && <span>{i + 1}</span>}
          </button>
        ) : (
          <div key={`e${i}`} className="cap-thumb empty" style={{ width: w, height: h }} aria-hidden="true" />
        );
      })}
    </div>
  );
}
