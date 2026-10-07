'use server';

/**
 * @fileOverview AI flows for The Culture Capsule (the ice-breaker QR activity).
 * The crews draft The One Island Constitution: each crew of 8 answers four questions
 * (what makes the island unique, who can join, what we never do, what we appreciate).
 *
 * - groupCultureThemes - clusters the crews' answers into themes, per question (shown live on the big screen).
 * - writeOneIslandConstitution - merges every crew's answers into ONE constitution.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MAX_QUESTIONS = 8;

const CrewSchema = z.object({
  crewName: z.string(),
  leaderName: z.string(),
  answers: z.array(z.string()).min(1).max(MAX_QUESTIONS),
});

const BaseInputSchema = z.object({
  questions: z.array(z.string()).min(1).max(MAX_QUESTIONS),
  crews: z.array(CrewSchema).min(1),
  language: z.enum(['en', 'ar']),
});
export type CultureAIInput = z.infer<typeof BaseInputSchema>;

const ThemesOutputSchema = z.object({
  byQuestion: z
    .array(
      z.object({
        themes: z
          .array(
            z.object({
              theme: z.string().describe('Short label, max 6 words.'),
              crews: z.number().int().describe('How many different crews expressed this theme.'),
              quote: z.string().describe("A short fragment copied from one crew's own answer."),
            })
          )
          .max(5),
      })
    )
    .min(1)
    .max(MAX_QUESTIONS),
});
export type CultureThemesOutput = z.infer<typeof ThemesOutputSchema>;

const ConstitutionOutputSchema = z.object({
  title: z.string(),
  preamble: z.string().describe('Two sentences in the voice of the crews.'),
  articles: z
    .array(
      z.object({
        heading: z.string().describe('The fixed article heading given in the instructions.'),
        clauses: z.array(z.string()).min(2).max(4),
      })
    )
    .length(4),
  closing: z.string().describe('One line handing the constitution to whoever leads the island next.'),
  signOff: z.string(),
});
export type OneIslandConstitutionOutput = z.infer<typeof ConstitutionOutputSchema>;

const LANGUAGE_NAME = {
  en: 'English',
  ar: 'Arabic (Modern Standard Arabic, dignified but simple, easy to read aloud)',
} as const;

/** Fixed titles so the screen, the phone and the document always agree. */
const FIXED = {
  en: {
    title: 'The One Island Constitution',
    headings: ['Our identity', 'Who can join', 'Our red lines', 'What we cherish'],
    signOff: 'Signed by the crews of The One Island',
  },
  ar: {
    title: 'دستور الجزيرة الواحدة',
    headings: ['هويتنا', 'من يمكنه الانضمام', 'خطوطنا الحمراء', 'ما نعتز به'],
    signOff: 'وقّعته فرق الجزيرة الواحدة',
  },
} as const;

function formatAnswers(input: CultureAIInput): string {
  const questions = input.questions.map((q, i) => `Q${i + 1}. ${q}`).join('\n');
  const crews = input.crews
    .map(
      (c, i) =>
        `Crew ${i + 1}${c.crewName ? ` ("${c.crewName}")` : ''}:\n` +
        c.answers.map((a, j) => `  Q${j + 1}: ${a}`).join('\n')
    )
    .join('\n');
  return `${questions}\n\nAnswers (each crew of 8 agreed on one answer per question):\n${crews}`;
}

const GROUND_RULES = `Ground rules:
- Use ONLY what the crews wrote. Do not invent facts, numbers, history, product names or people.
- Never name an individual. No blame. Stay honest, but state criticism constructively.
- Always write the company's name as "etisalat" (lowercase). Never write "e&".
- The answers may be in English, Arabic or a mix; understand them all.`;

export async function groupCultureThemes(input: CultureAIInput): Promise<CultureThemesOutput> {
  return groupCultureThemesFlow(input);
}

export async function writeOneIslandConstitution(input: CultureAIInput): Promise<OneIslandConstitutionOutput> {
  return writeConstitutionFlow(input);
}

const groupCultureThemesFlow = ai.defineFlow(
  {
    name: 'groupCultureThemesFlow',
    inputSchema: BaseInputSchema,
    outputSchema: ThemesOutputSchema,
  },
  async input => {
    const {output} = await ai.generate({
      prompt: `You are helping a live team-building event at etisalat Egypt. Crews of 8 employees imagined a shared island, "The One Island", and answered questions about it.
Group the answers into themes, separately for each question.

${formatAnswers(input)}

For each of the ${input.questions.length} questions return up to 5 themes, ordered by how many different crews expressed them (most first).
- "theme": a short label (max 6 words) written in ${LANGUAGE_NAME[input.language]}.
- "crews": the number of different crews whose answer expresses it (never more than ${input.crews.length}).
- "quote": a short fragment copied word for word from one crew's answer (keep its original language).
Merge near-duplicates. Skip themes mentioned by only one crew when there are many crews.

${GROUND_RULES}`,
      output: {schema: ThemesOutputSchema},
      config: {temperature: 0.3},
    });
    if (!output) throw new Error('The AI returned no themes.');
    return output;
  }
);

const writeConstitutionFlow = ai.defineFlow(
  {
    name: 'writeOneIslandConstitutionFlow',
    inputSchema: BaseInputSchema,
    outputSchema: ConstitutionOutputSchema,
  },
  async input => {
    const fixed = FIXED[input.language];
    const {output} = await ai.generate({
      prompt: `At a team-building event, ${input.crews.length} crews of 8 etisalat employees imagined a shared island, "The One Island", and each crew drafted its own answers to four questions about it.
Merge ALL crews' answers into ONE constitution of The One Island ("دستور الجزيرة الواحدة"). Write it in ${LANGUAGE_NAME[input.language]}.

${formatAnswers(input)}

Return exactly:
- "title": "${fixed.title}"
- "preamble": two sentences in the crews' voice ("We, the crews of The One Island, ...") saying we write this together so that everyone who comes after us knows who we are.
- "articles": exactly four, in this order, each with the fixed heading and 2 to 4 clauses:
  1. heading "${fixed.headings[0]}" from Q1 (what makes the island unique).
  2. heading "${fixed.headings[1]}" from Q2 (who can join and what they must be like). Phrase the clauses as conditions of belonging ("Anyone who...", "Everyone who joins...").
  3. heading "${fixed.headings[2]}" from Q3 (what we must never do). Phrase the clauses as firm commitments ("We never...", "No one on the island...").
  4. heading "${fixed.headings[3]}" from Q4 (what we appreciate). Phrase the clauses as what we cherish and protect.
- "closing": one line handing the constitution to whoever leads the island next (the managers of tomorrow).
- "signOff": "${fixed.signOff}"

How to write the clauses: one sentence each, at most 22 words, plain present tense, in the crews' voice ("we"). Merge duplicate ideas, put the ideas more crews shared first, and keep a crew's own striking phrase when it is strong. No corporate clichés (synergy, leverage, best-in-class). Keep the whole constitution under 300 words so it can be read aloud and fit on one page.

${GROUND_RULES}`,
      output: {schema: ConstitutionOutputSchema},
      config: {temperature: 0.6},
    });
    if (!output) throw new Error('The AI returned no constitution.');
    return output;
  }
);
