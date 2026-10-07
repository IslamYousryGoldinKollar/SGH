'use server';

import {
  groupCultureThemes,
  writeLetterToFutureManagers,
  type CultureAIInput,
} from '@/ai/flows/capsule-culture';
import {
  LIMITS,
  type CapsuleLetter,
  type CapsuleThemes,
  type CrewForAI,
  type LetterLanguage,
} from '@/lib/capsule/types';

export type ActionResult<T> = {ok: true; data: T} | {ok: false; error: string};

interface Payload {
  questions: string[];
  crews: CrewForAI[];
  language: LetterLanguage;
}

const cut = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max);

/** Server actions are public endpoints: cap and normalise everything before it reaches the model. */
function sanitise(p: Payload): CultureAIInput | string {
  if (!Array.isArray(p?.questions) || p.questions.length !== 3) return 'Expected exactly 3 questions.';
  if (!Array.isArray(p.crews) || p.crews.length === 0) return 'No crews have answered yet.';
  return {
    language: p.language === 'ar' ? 'ar' : 'en',
    questions: p.questions.map(q => cut(q, 300)),
    crews: p.crews.slice(0, LIMITS.maxCrewsForAI).map(c => ({
      crewName: cut(c?.crewName, LIMITS.crewName),
      leaderName: cut(c?.leaderName, LIMITS.leaderName),
      answers: [0, 1, 2].map(i => cut(c?.answers?.[i], LIMITS.answer)),
    })),
  };
}

function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api key|GEMINI_API_KEY|GOOGLE_API_KEY|permission|401|403/i.test(message)) {
    return 'The AI is not configured on the server. Set GEMINI_API_KEY and redeploy.';
  }
  if (/quota|429|rate/i.test(message)) {
    return 'The AI is busy right now (rate limit). Wait a few seconds and try again.';
  }
  return 'The AI could not finish this time. Try again.';
}

export async function groupThemesAction(payload: Payload): Promise<ActionResult<CapsuleThemes>> {
  const input = sanitise(payload);
  if (typeof input === 'string') return {ok: false, error: input};
  try {
    const out = await groupCultureThemes(input);
    return {
      ok: true,
      data: {
        language: input.language,
        generatedAt: Date.now(),
        crewCount: input.crews.length,
        byQuestion: out.byQuestion.map(q =>
          q.themes.map(t => ({
            theme: t.theme,
            crews: Math.max(1, Math.min(t.crews, input.crews.length)),
            quote: t.quote,
          }))
        ),
      },
    };
  } catch (error) {
    console.error('groupThemesAction failed:', error);
    return {ok: false, error: explain(error)};
  }
}

export async function writeLetterAction(payload: Payload): Promise<ActionResult<CapsuleLetter>> {
  const input = sanitise(payload);
  if (typeof input === 'string') return {ok: false, error: input};
  try {
    const out = await writeLetterToFutureManagers(input);
    return {
      ok: true,
      data: {
        ...out,
        language: input.language,
        generatedAt: Date.now(),
        crewCount: input.crews.length,
      },
    };
  } catch (error) {
    console.error('writeLetterAction failed:', error);
    return {ok: false, error: explain(error)};
  }
}
