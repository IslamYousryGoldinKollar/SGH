import type {
  CapsuleCrew,
  CapsuleCrewInput,
  CapsuleConstitution,
  CapsuleSession,
  CapsuleThemes,
} from "./types";
import { DEMO_SESSION_ID } from "./types";
import { createDemoStore } from "./demo-store";
import { createFirestoreStore } from "./firestore-store";

export type Unsubscribe = () => void;

/**
 * Everything the Culture Capsule screens need from a backend.
 * `DEMO` sessions run entirely in the browser (localStorage), real sessions run on Firestore.
 */
export interface CapsuleStore {
  readonly isDemo: boolean;
  subscribeSession(
    cb: (session: CapsuleSession | null) => void,
    onError?: (e: Error) => void
  ): Unsubscribe;
  subscribeCrews(
    cb: (crews: CapsuleCrew[]) => void,
    onError?: (e: Error) => void
  ): Unsubscribe;
  /** Leader's phone → big screen. Returns the new crew id. */
  submitCrew(input: CapsuleCrewInput): Promise<string>;

  // --- admin only (Firestore rules enforce this; demo allows everything) ---
  setStatus(status: CapsuleSession["status"]): Promise<void>;
  saveThemes(themes: CapsuleThemes): Promise<void>;
  saveConstitution(constitution: CapsuleConstitution): Promise<void>;
  clearConstitution(): Promise<void>;
  deleteCrew(crewId: string): Promise<void>;
  /** Demo only: drop in a sample crew so the wall can be rehearsed. */
  addSampleCrew?(): Promise<void>;
  /** Demo only: wipe everything. */
  resetDemo?(): Promise<void>;
}

export function normaliseSessionId(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase();
}

export function getCapsuleStore(rawSessionId: string): CapsuleStore {
  const sessionId = normaliseSessionId(rawSessionId);
  return sessionId === DEMO_SESSION_ID
    ? createDemoStore()
    : createFirestoreStore(sessionId);
}
