'use server';

/**
 * @fileOverview AI flows for The Culture Capsule (the ice-breaker QR activity).
 *
 * - groupCultureThemes - clusters the crews' answers into themes, per question (shown live on the big screen).
 * - writeLetterToFutureManagers - turns every crew's answers into one letter to the future managers.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CrewSchema = z.object({
  crewName: z.string(),
  leaderName: z.string(),
  answers: z.array(z.string()).length(3),
});

const BaseInputSchema = z.object({
  questions: z.array(z.string()).length(3),
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
    .length(3),
});
export type CultureThemesOutput = z.infer<typeof ThemesOutputSchema>;

const LetterOutputSchema = z.object({
  title: z.string(),
  salutation: z.string(),
  opening: z.string().describe('Two sentences that set the scene.'),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string(),
        bullets: z.array(z.string()).optional(),
      })
    )
    .length(3),
  closing: z.string().describe('One memorable line.'),
  signOff: z.string(),
});
export type CultureLetterOutput = z.infer<typeof LetterOutputSchema>;

const LANGUAGE_NAME = {
  en: 'English',
  ar: 'Arabic (Modern Standard Arabic, warm and simple, easy to read aloud)',
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
- The answers may be in English, Arabic or a mix; understand them all.`;

export async function groupCultureThemes(input: CultureAIInput): Promise<CultureThemesOutput> {
  return groupCultureThemesFlow(input);
}

export async function writeLetterToFutureManagers(input: CultureAIInput): Promise<CultureLetterOutput> {
  return writeLetterFlow(input);
}

const groupCultureThemesFlow = ai.defineFlow(
  {
    name: 'groupCultureThemesFlow',
    inputSchema: BaseInputSchema,
    outputSchema: ThemesOutputSchema,
  },
  async input => {
    const {output} = await ai.generate({
      prompt: `You are helping a live team-building event at e& Egypt. Crews of 8 employees answered three questions about their company culture.
Group the answers into themes, separately for each question.

${formatAnswers(input)}

For each of the 3 questions return up to 5 themes, ordered by how many different crews expressed them (most first).
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

const writeLetterFlow = ai.defineFlow(
  {
    name: 'writeLetterToFutureManagersFlow',
    inputSchema: BaseInputSchema,
    outputSchema: LetterOutputSchema,
  },
  async input => {
    const {output} = await ai.generate({
      prompt: `At a team-building event, ${input.crews.length} crews of 8 employees of e& Egypt (e&, formerly Etisalat) each discussed three questions about their culture and agreed on one answer per question.
Write ONE letter from all of them to the future managers of the company. Write in ${LANGUAGE_NAME[input.language]}.

${formatAnswers(input)}

The letter speaks as "we" (the crews) to the managers who will lead e& in the years to come. It must cover, as exactly three sections in this order:
1. What e& is. Who we are, in the crews' own words.
2. What defines our culture. The traits the crews named most often (Q1) and what makes e& different from other companies (Q2).
3. What you need to do to keep it unique and successful. Open with one or two sentences, then give 4 to 5 concrete bullets, each starting with a verb: protect what we love (Q1, Q2) and remove what we asked to make disappear (Q3).

Also write: a "title" (A letter to the future managers of e&), a "salutation", an "opening" (two sentences that set the scene: crews, an island, one shared answer), a one-line "closing", and a "signOff" from the crews of The One Island 2026.
Style: warm, proud, direct and specific. No corporate clichés (synergy, leverage, best-in-class). Weave in two or three short quotes from the crews. Keep the whole letter under 280 words so it can be read aloud in two minutes and fit on one page. Section headings must be short.

${GROUND_RULES}`,
      output: {schema: LetterOutputSchema},
      config: {temperature: 0.7},
    });
    if (!output) throw new Error('The AI returned no letter.');
    return output;
  }
);
