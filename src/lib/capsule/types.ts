/**
 * The Culture Capsule: the crews draft The One Island Constitution (دستور الجزيرة الواحدة).
 *
 * Every crew of 8 answers four questions, one per article:
 *   1. what makes the island unique   2. who can join   3. what we never do   4. what we appreciate
 * The AI then merges every crew's answers into ONE constitution.
 *
 * Firestore layout:
 *   capsule_sessions/{sessionId}                 CapsuleSession
 *   capsule_sessions/{sessionId}/crews/{crewId}  CapsuleCrew  (create-only, one per crew leader's phone)
 */

export const DEMO_SESSION_ID = "DEMO";

/** A crew = the leader + 7 followers. */
export const CREW_SIZE = 8;

export const DEFAULT_QUESTIONS: string[] = [
  "What makes The One Island unique?",
  "Who can join The One Island, and what must they be like?",
  "What must we never do on The One Island?",
  "What do we appreciate most on The One Island?",
];

/** Number of questions (= articles). The Firestore rules expect exactly this many answers. */
export const QUESTION_COUNT = DEFAULT_QUESTIONS.length;

/** Short names of the articles, shown on the phone, the wall and the themes. */
export const ARTICLE_TITLES: string[] = ["Our identity", "Who can join", "Our red lines", "What we cherish"];

const AR_ORDINALS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];

/** "Article 2" / "المادة الثانية" */
export function articleLabel(n: number, language: OutputLanguage = "en"): string {
  return language === "ar" ? `المادة ${AR_ORDINALS[n - 1] ?? n}` : `Article ${n}`;
}

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

export type OutputLanguage = "en" | "ar";

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
  constitution?: CapsuleConstitution | null;
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
  language: OutputLanguage;
  generatedAt: number;
  crewCount: number;
  /** One entry per question, same order as session.questions. */
  byQuestion: ThemeItem[][];
}

export interface ConstitutionArticle {
  heading: string;
  /** 2-4 short clauses, built from the crews' own words. */
  clauses: string[];
}

export interface CapsuleConstitution {
  language: OutputLanguage;
  generatedAt: number;
  crewCount: number;
  title: string;
  preamble: string;
  /** One article per question, same order. */
  articles: ConstitutionArticle[];
  /** Hands the constitution to whoever leads the island next. */
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
