import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CapsuleStore, Unsubscribe } from "./store";
import {
  DEFAULT_QUESTIONS,
  QUESTION_COUNT,
  type CapsuleCrew,
  type CapsuleConstitution,
  type CapsuleSession,
  type CapsuleThemes,
} from "./types";

const SESSIONS = "capsule_sessions";
const CREWS = "crews";

const toMillis = (value: unknown): number => {
  if (value && typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }
  return typeof value === "number" ? value : Date.now();
};

/** Firestore rejects `undefined`; JSON round-trip drops it. */
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function mapSession(id: string, data: DocumentData): CapsuleSession {
  return {
    id,
    title: data.title ?? "The One Island Constitution",
    adminId: data.adminId ?? "",
    status: data.status === "closed" ? "closed" : "open",
    questions:
      Array.isArray(data.questions) && data.questions.length === QUESTION_COUNT
        ? data.questions
        : DEFAULT_QUESTIONS,
    expectedCrews: Number(data.expectedCrews) || 25,
    createdAt: toMillis(data.createdAt),
    themes: data.themes ?? null,
    constitution: data.constitution ?? null,
  };
}

/**
 * Crew photos come from unauthenticated phones, so only ever render real image data URLs.
 * (They are used as <img src> and inside CSS url("..."), so no quotes, backslashes or line breaks.)
 */
const safePhoto = (value: unknown): string =>
  typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";

function mapCrew(id: string, data: DocumentData): CapsuleCrew {
  return {
    id,
    leaderName: data.leaderName ?? "",
    crewName: data.crewName ?? "",
    answers: Array.isArray(data.answers) ? data.answers : [],
    photo: safePhoto(data.photo),
    createdAt: toMillis(data.createdAt),
  };
}

export function createFirestoreStore(sessionId: string): CapsuleStore {
  const sessionRef = doc(db, SESSIONS, sessionId);
  const crewsRef = collection(db, SESSIONS, sessionId, CREWS);

  return {
    isDemo: false,

    subscribeSession(cb, onError): Unsubscribe {
      return onSnapshot(
        sessionRef,
        (snap) => cb(snap.exists() ? mapSession(snap.id, snap.data()) : null),
        (e) => onError?.(e)
      );
    },

    subscribeCrews(cb, onError): Unsubscribe {
      return onSnapshot(
        query(crewsRef, orderBy("createdAt", "asc")),
        (snap) =>
          cb(
            snap.docs.map((d) =>
              mapCrew(d.id, d.data({ serverTimestamps: "estimate" }))
            )
          ),
        (e) => onError?.(e)
      );
    },

    async submitCrew(input) {
      const ref = await addDoc(crewsRef, {
        leaderName: input.leaderName,
        crewName: input.crewName,
        answers: input.answers,
        photo: input.photo,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },

    async setStatus(status) {
      await updateDoc(sessionRef, { status });
    },
    async saveThemes(themes: CapsuleThemes) {
      await updateDoc(sessionRef, { themes: clean(themes) });
    },
    async saveConstitution(constitution: CapsuleConstitution) {
      await updateDoc(sessionRef, { constitution: clean(constitution) });
    },
    async clearConstitution() {
      await updateDoc(sessionRef, { constitution: null });
    },
    async deleteCrew(crewId) {
      await deleteDoc(doc(db, SESSIONS, sessionId, CREWS, crewId));
    },
  };
}

// ---------------------------------------------------------------------------
// Admin helpers (used by /admin/capsule)
// ---------------------------------------------------------------------------

// No 0/O/1/I so the code is easy to read out and type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");

export async function createCapsuleSession(
  adminId: string,
  opts: { title?: string; expectedCrews?: number; questions?: string[] } = {}
): Promise<string> {
  const id = makeCode();
  await setDoc(doc(db, SESSIONS, id), {
    title: opts.title?.trim() || "The One Island Constitution",
    adminId,
    status: "open",
    questions: opts.questions ?? DEFAULT_QUESTIONS,
    expectedCrews: opts.expectedCrews ?? 25,
    createdAt: serverTimestamp(),
    themes: null,
    constitution: null,
  });
  return id;
}

export function subscribeAdminSessions(
  adminId: string,
  cb: (sessions: CapsuleSession[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, SESSIONS), where("adminId", "==", adminId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => mapSession(d.id, d.data({ serverTimestamps: "estimate" })))
          .sort((a, b) => b.createdAt - a.createdAt)
      ),
    (e) => onError?.(e)
  );
}

export async function deleteCapsuleSession(sessionId: string): Promise<void> {
  const crews = await getDocs(collection(db, SESSIONS, sessionId, CREWS));
  // Batches are capped at 500 writes; a session never has more than ~100 crews.
  const batch = writeBatch(db);
  crews.forEach((c) => batch.delete(c.ref));
  batch.delete(doc(db, SESSIONS, sessionId));
  await batch.commit();
}
