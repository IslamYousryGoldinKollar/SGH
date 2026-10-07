/**
 * The Culture Capsule — data model.
 *
 * Firestore layout:
 *   capsule_sessions/{sessionId}                 CapsuleSession
 *   capsule_sessions/{sessionId}/crews/{crewId}  CapsuleCrew  (create-only, one per crew leader's phone)
 */

export const DEMO_SESSION_ID = "DEMO";

/** A crew = the leader + 7 followers. */
export const CREW_SIZE = 8;

export const DEFAULT_QUESTIONS: string[] = [
  "What is the top thing you appreciate in our culture?",
  "What differentiates us, as a culture, from other companies?",
  "What do you wish would magically disappear from our culture?",
];

/** Short labels used on the big screen / letter for each question. */
export const QUESTION_LABELS: string[] = [
  "What we appreciate",
  "What makes us different",
  "What we'd make disappear",
];

export const LIMITS = {
  leaderName: 60,
  crewName: 60,
  answer: 400,
  /** What the phone lets a crew type (short enough to read from across the lawn). */
  answerInput: 240,
  /** Max crews sent to the AI in one request. */
  maxCrewsForAI: 80,
  /** Firestore rules cap the base64 photo string below this (1 MiB doc limit). */
  photoChars: 700_000,
} as const;

export type LetterLanguage = "en" | "ar";

export interface CapsuleSession {
  id: string;
  title: string;
  adminId: string;
  status: "open" | "closed";
  questions: string[];
  /** How many crews we expect (≈ people / 8). Used for the "18 / 25" counter. */
  expectedCrews: number;
  createdAt: number;
  themes?: CapsuleThemes | null;
  letter?: CapsuleLetter | null;
}

export interface CapsuleCrew {
  id: string;
  leaderName: string;
  crewName: string;
  /** One answer per question, same order as session.questions. */
  answers: string[];
  /** JPEG data URL of the group selfie. */
  photo: string;
  createdAt: number;
}

/** What a leader's phone sends. */
export type CapsuleCrewInput = Omit<CapsuleCrew, "id" | "createdAt">;

export interface ThemeItem {
  theme: string;
  /** How many crews mentioned this theme. */
  crews: number;
  /** A short quote taken from the crews' own words. */
  quote: string;
}

export interface CapsuleThemes {
  language: LetterLanguage;
  generatedAt: number;
  crewCount: number;
  /** One entry per question, same order as session.questions. */
  byQuestion: ThemeItem[][];
}

export interface LetterSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface CapsuleLetter {
  language: LetterLanguage;
  generatedAt: number;
  crewCount: number;
  title: string;
  salutation: string;
  opening: string;
  /** Exactly three: what e& is · what defines the culture · what to do to keep it unique & successful. */
  sections: LetterSection[];
  closing: string;
  signOff: string;
  /** True when this is canned sample copy (demo mode with AI unavailable). */
  sample?: boolean;
}

/** Compact crew payload sent to the AI (no photos). */
export interface CrewForAI {
  crewName: string;
  leaderName: string;
  answers: string[];
}
