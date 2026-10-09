"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Mic,
  Send,
} from "lucide-react";
import { useCapsuleSession, useCapsuleStore } from "@/hooks/useCapsule";
import { compressImage } from "@/lib/capsule/image";
import { ARTICLE_TITLES, CREW_SIZE, LIMITS, QUESTION_COUNT, articleLabel } from "@/lib/capsule/types";

/**
 * What the QR code opens. One phone per crew: the crew leader reads each question out loud,
 * the crew agrees on an answer together, the leader types it in, then takes the group selfie.
 *
 *   0 welcome · 1..N questions (one article each) · N+1 selfie · N+2 review · then the "done" screen
 */

const STEP_PHOTO = QUESTION_COUNT + 1;
const STEP_REVIEW = QUESTION_COUNT + 2;

interface Draft {
  step: number;
  leaderName: string;
  crewName: string;
  answers: string[];
  photo: string;
}

interface Done {
  crewId: string;
  leaderName: string;
  crewName: string;
  photo: string;
}

const EMPTY_DRAFT: Draft = { step: 0, leaderName: "", crewName: "", answers: Array.from({ length: QUESTION_COUNT }, () => ""), photo: "" };

const draftKey = (id: string) => `capsule:${id}:draft`;
const doneKey = (id: string) => `capsule:${id}:done`;

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / full: the draft just won't survive a reload */
  }
}
function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) {
    return "The host has closed submissions, or this link is no longer active. Ask the host to check.";
  }
  if (code.includes("unavailable") || /network|offline/i.test(String((e as Error)?.message))) {
    return "No connection right now. Check your signal and tap Send again. Your answers are saved.";
  }
  return "Something went wrong while sending. Tap Send to try again. Your answers are saved.";
}

export default function LeaderFlow({ sessionId }: { sessionId: string }) {
  const store = useCapsuleStore(sessionId);
  const { data: session, loading: sessionLoading, error: sessionError } = useCapsuleSession(store);

  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState<"photo" | "send" | null>(null);
  const [slowSend, setSlowSend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Restore draft / earlier submission (a reload must never lose a crew's typed answers).
  useEffect(() => {
    const finished = readJSON<Done>(doneKey(sessionId));
    if (finished) {
      setDone(finished);
    } else {
      const saved = readJSON<Draft>(draftKey(sessionId));
      if (saved) setDraft({ ...EMPTY_DRAFT, ...saved, answers: Array.from({ length: QUESTION_COUNT }, (_, i) => saved.answers?.[i] ?? "") });
    }
    setHydrated(true);
  }, [sessionId]);

  useEffect(() => {
    if (hydrated && !done) writeJSON(draftKey(sessionId), draft);
  }, [draft, done, hydrated, sessionId]);

  // Firestore queues a write while offline and never rejects it, so say so instead of spinning silently.
  useEffect(() => {
    if (busy !== "send") {
      setSlowSend(false);
      return;
    }
    const t = window.setTimeout(() => setSlowSend(true), 12000);
    return () => window.clearTimeout(t);
  }, [busy]);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);
  const goto = (step: number) => {
    setError(null);
    patch({ step });
    window.scrollTo({ top: 0 });
  };

  const questions = session?.questions ?? [];
  const answerOk = (i: number) => draft.answers[i].trim().length >= 3;
  const nameOk = draft.leaderName.trim().length >= 2;

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy("photo");
    setError(null);
    try {
      patch({ photo: await compressImage(file) });
    } catch {
      setError("We couldn't read that photo. Please try the camera again.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (busy) return;
    setBusy("send");
    setError(null);
    try {
      const leaderName = draft.leaderName.trim().slice(0, LIMITS.leaderName);
      const crewName = draft.crewName.trim().slice(0, LIMITS.crewName);
      const crewId = await store.submitCrew({
        leaderName,
        crewName,
        answers: draft.answers.map((a) => a.trim().slice(0, LIMITS.answerInput)),
        photo: draft.photo,
      });
      const finished: Done = { crewId, leaderName, crewName, photo: draft.photo };
      writeJSON(doneKey(sessionId), finished);
      removeKey(draftKey(sessionId));
      setDone(finished);
      void import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.65 }, colors: ["#E00800", "#ffffff", "#181F4B", "#47CB6C"] });
      });
    } catch (e) {
      console.error("submitCrew failed", e);
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    if (!window.confirm("Start again? Only do this if the host removed your first entry. Otherwise your crew will appear twice.")) return;
    removeKey(doneKey(sessionId));
    removeKey(draftKey(sessionId));
    setDone(null);
    setDraft(EMPTY_DRAFT);
  }

  // ---------------------------------------------------------------- states
  if (!hydrated || sessionLoading) {
    return (
      <Shell>
        <div className="cap-center" role="status" aria-live="polite">
          <div className="cap-spin" />
          <p className="cap-lead">Opening the Culture Capsule…</p>
        </div>
      </Shell>
    );
  }

  if (sessionError || !session) {
    return (
      <Shell>
        <div className="cap-center">
          <h1 className="cap-h2">We can&apos;t find this capsule</h1>
          <p className="cap-lead">
            {sessionError
              ? "We couldn't reach the server. Check your connection and scan the QR code again."
              : "The link may be old. Scan the QR code on the big screen again."}
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="cap-done cap-fadein">
          <div className="tick">
            <Check aria-hidden />
          </div>
          <h1 className="cap-h1">Your crew is in!</h1>
          <p className="cap-lead">
            Look up: {done.crewName || `${done.leaderName}'s crew`} is appearing on the big screen right now.
          </p>
          {done.photo && (
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={done.photo} alt="Your crew's group selfie" />
            </div>
          )}
          <button className="cap-link" onClick={startOver}>
            Something wrong? Start over
          </button>
        </div>
      </Shell>
    );
  }

  if (session.status === "closed") {
    return (
      <Shell>
        <div className="cap-center">
          <h1 className="cap-h2">The capsule is sealed</h1>
          <p className="cap-lead">The host has closed submissions. Thank you for taking part!</p>
        </div>
      </Shell>
    );
  }

  const step = draft.step;
  const qIndex = step - 1; // 0..2 on question steps

  return (
    <Shell
      step={step}
      onBack={step > 0 ? () => goto(step - 1) : undefined}
    >
      {/* ------------------------------------------------ 0 · welcome */}
      {step === 0 && (
        <div className="cap-body cap-fadein">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cap-logo" src="/one-island/logo.svg" alt="The One Island · etisalat" />
          <div>
            <div className="cap-eyebrow">
              <i />
              The One Island Constitution
            </div>
            <h1 className="cap-h1" style={{ marginTop: 10 }}>
              You lead your crew.
            </h1>
          </div>
          <p className="cap-lead">
            Your crew of {CREW_SIZE} is about to write the first articles of The One Island constitution, for everyone at etisalat who comes after us. You&apos;re holding the phone, so you&apos;re the leader.
          </p>
          <div className="cap-steps">
            <div className="cap-step">
              <b>1</b>
              <div>
                Read each question out loud<small>{questions.length} articles to draft</small>
              </div>
            </div>
            <div className="cap-step">
              <b>2</b>
              <div>
                Agree on one answer together<small>Then type it in</small>
              </div>
            </div>
            <div className="cap-step">
              <b>3</b>
              <div>
                Take a group selfie<small>Everyone in the frame</small>
              </div>
            </div>
          </div>
          <div className="cap-field">
            <label className="cap-label" htmlFor="leader">
              Your name
            </label>
            <input
              id="leader"
              className="cap-input"
              value={draft.leaderName}
              maxLength={LIMITS.leaderName}
              autoComplete="given-name"
              placeholder="Leader's name"
              onChange={(e) => patch({ leaderName: e.target.value })}
            />
          </div>
          <div className="cap-field">
            <label className="cap-label" htmlFor="crew">
              Crew name <small>(optional)</small>
            </label>
            <input
              id="crew"
              className="cap-input"
              value={draft.crewName}
              maxLength={LIMITS.crewName}
              placeholder="e.g. The Navigators"
              onChange={(e) => patch({ crewName: e.target.value })}
            />
          </div>
          <div className="cap-note">One phone per crew. Only the leader scans, once.</div>
          <div className="cap-actions">
            <button className="cap-btn" disabled={!nameOk} onClick={() => goto(1)}>
              Start <ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ 1..N · questions */}
      {step >= 1 && step <= QUESTION_COUNT && (
        <div className="cap-body cap-fadein" key={`q${qIndex}`}>
          <div className="cap-qcard">
            <div className="cap-qnum">
              {articleLabel(qIndex + 1)} of {questions.length} · {ARTICLE_TITLES[qIndex]}
            </div>
            <h1 className="cap-q">{questions[qIndex]}</h1>
            <div className="cap-hint">
              <Mic aria-hidden />
              Read it out loud, talk it through, then type the answer your crew agrees on.
            </div>
          </div>
          <div className="cap-field">
            <label className="cap-label" htmlFor="answer">
              Your crew&apos;s answer
            </label>
            <textarea
              id="answer"
              className="cap-textarea"
              dir="auto"
              value={draft.answers[qIndex]}
              maxLength={LIMITS.answerInput}
              placeholder="Type it here…"
              onChange={(e) => {
                const answers = [...draft.answers];
                answers[qIndex] = e.target.value;
                patch({ answers });
              }}
            />
            <div className="cap-meta">
              <span>{answerOk(qIndex) ? "Looks good" : "At least a few words"}</span>
              <span>
                {draft.answers[qIndex].length} / {LIMITS.answerInput}
              </span>
            </div>
          </div>
          <div className="cap-actions">
            <button className="cap-btn" disabled={!answerOk(qIndex)} onClick={() => goto(step + 1)}>
              {qIndex === QUESTION_COUNT - 1 ? "Selfie time" : "Next"} <ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ 4 · selfie */}
      {step === STEP_PHOTO && (
        <div className="cap-body cap-fadein">
          <div>
            <div className="cap-eyebrow">
              <i />
              Last step
            </div>
            <h1 className="cap-h2" style={{ marginTop: 10 }}>
              Group selfie!
            </h1>
          </div>
          <p className="cap-lead">Squeeze in: the leader and all {CREW_SIZE - 1} followers. Hold the phone out and smile.</p>
          <div className={`cap-photo ${draft.photo ? "has" : ""}`}>
            {draft.photo ? (
              <>
                <div className="blur" style={{ backgroundImage: `url("${draft.photo}")` }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.photo} alt="Your crew's group selfie" />
              </>
            ) : (
              <div>
                <Camera aria-hidden style={{ margin: "0 auto" }} />
                <p>{busy === "photo" ? "Getting your photo ready…" : "Your selfie will show up here"}</p>
              </div>
            )}
          </div>
          {error && <div className="cap-error" role="alert">{error}</div>}
          {/* capture="user" opens the front camera on phones; the second input is a plain gallery picker */}
          <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={onPickPhoto} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          <div className="cap-actions">
            {draft.photo ? (
              <>
                <button className="cap-btn" onClick={() => goto(STEP_REVIEW)}>
                  Looks great <ArrowRight aria-hidden />
                </button>
                <button className="cap-btn ghost" disabled={busy === "photo"} onClick={() => cameraRef.current?.click()}>
                  <Camera aria-hidden /> Retake
                </button>
              </>
            ) : (
              <>
                <button className="cap-btn" disabled={busy === "photo"} onClick={() => cameraRef.current?.click()}>
                  <Camera aria-hidden /> Open camera
                </button>
                <button className="cap-link" onClick={() => galleryRef.current?.click()}>
                  <ImageIcon aria-hidden style={{ width: 16, height: 16, display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
                  Choose from gallery instead
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ 5 · review */}
      {step === STEP_REVIEW && (
        <div className="cap-body cap-fadein">
          <div>
            <div className="cap-eyebrow">
              <i />
              Almost there
            </div>
            <h1 className="cap-h2" style={{ marginTop: 10 }}>
              Ready to send?
            </h1>
          </div>
          {draft.photo && (
            <div className="cap-photo has">
              <div className="blur" style={{ backgroundImage: `url("${draft.photo}")` }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.photo} alt="Your crew's group selfie" />
            </div>
          )}
          <div className="cap-review">
            {questions.map((q, i) => (
              <button key={i} className="cap-ritem" onClick={() => goto(i + 1)}>
                <small>
                  {articleLabel(i + 1)} · {ARTICLE_TITLES[i]}
                </small>
                <em className="q">{q}</em>
                <span dir="auto">{draft.answers[i]}</span>
              </button>
            ))}
          </div>
          <div className="cap-note">Tap an answer to change it.</div>
          {error && <div className="cap-error" role="alert">{error}</div>}
          {slowSend && (
            <div className="cap-note" role="status">
              Still sending… your signal may be weak. Keep this page open until you see the green tick. Your answers are saved.
            </div>
          )}
          <div className="cap-actions">
            <button className="cap-btn" disabled={busy === "send" || !draft.photo} onClick={send}>
              {busy === "send" ? "Sending…" : "Send to the big screen"} <Send aria-hidden />
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  step,
  onBack,
}: {
  children: React.ReactNode;
  step?: number;
  onBack?: () => void;
}) {
  const showProgress = typeof step === "number" && step > 0;
  return (
    <div className="cap-phone-bg">
      <svg className="cap-phone-sea" viewBox="0 0 520 190" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 80C90 40 170 110 260 70S430 40 520 80V190H0Z" fill="#E00800" opacity=".12" />
        <path d="M0 110C100 70 190 140 280 100S440 80 520 110V190H0Z" fill="#7C0124" opacity=".16" />
        <path d="M0 140C110 110 200 170 290 140S450 120 520 140V190H0Z" fill="#181F4B" opacity=".2" />
      </svg>
      <div className="cap-phone">
        <div className="cap-top">
          {onBack && (
            <button className="cap-back" onClick={onBack} aria-label="Back">
              <ChevronLeft aria-hidden />
            </button>
          )}
          {showProgress && (
            <>
              <div className="cap-progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEP_REVIEW} aria-valuenow={step}>
                <i style={{ width: `${(Math.min(step!, STEP_REVIEW) / STEP_REVIEW) * 100}%` }} />
              </div>
              <span className="cap-count">
                {step! <= QUESTION_COUNT ? `${step} / ${QUESTION_COUNT}` : step === STEP_PHOTO ? "Selfie" : "Review"}
              </span>
            </>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
