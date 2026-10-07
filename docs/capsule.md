# The Culture Capsule: drafting The One Island Constitution (دستور الجزيرة الواحدة)

Part of **The One Island** team-building experience (etisalat Egypt). The updated experience deck is in
[`docs/experience/index.html`](experience/index.html) (slides 12-16 and 30).

## What happens on the day

1. The icebreaker ends with crews of **8** (a leader and 7 followers). About 200 people make about 25 crews.
2. The big screen shows **one QR code**. Each crew's **leader scans it once**.
3. The crews are the founders of the island, drafting its constitution. The leader reads each of four questions out loud, the crew agrees on one answer together, and the leader types it. Each question is one **article**:
   1. **Our identity**: What makes The One Island unique?
   2. **Who can join**: Who can join The One Island, and what must they be like?
   3. **Our red lines**: What must we never do on The One Island?
   4. **What we cherish**: What do we appreciate most on The One Island?
4. The crew takes a **group selfie** and sends everything.
5. The big screen fills **live**: a spotlight rotates through the crews (their four answers and group photo), with every selfie in a strip below.
6. The AI **groups the answers into themes**, then **merges every crew's answers into ONE constitution**: a preamble, four articles with 2-4 clauses each, a closing line handing it to whoever leads the island next, and the signatures (every crew's selfie). The constitution is revealed page by page on the big screen, and a printable page is available.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/admin/capsule` | Admin (signed in) | Create a capsule, get the phone link and QR, open the screen, delete |
| `/capsule/<CODE>/screen` | Presenter / projector | The big screen. The toolbar only appears for the capsule's owner |
| `/capsule/<CODE>` | Crew leader's phone | What the QR code opens |
| `/capsule/<CODE>/constitution` | Anyone with the link | Printable constitution with every signing crew (Print / Save as PDF) |
| `/capsule/DEMO/screen` and `/capsule/DEMO` | Rehearsal | Runs entirely in the browser (localStorage), no Firebase needed. Open both in two tabs of one browser |

Big-screen toolbar (fades after a few seconds; move the mouse to bring it back): **Auto** (QR, then wall, then constitution) · **QR** (1) · **Wall** (2) ·
**Themes** (3) · **Constitution** (4) · **Group answers** (AI) · **Draft constitution** (AI) · **EN / عربي** (language of the next AI output) ·
**Close submissions** · **Remove crew** (the crew currently in the spotlight) · **Fullscreen** (F). In the constitution view, ← → / PageUp PageDown / Space (a presentation clicker) turn the pages.

## Before the event: set-up checklist

1. **Publish the Firestore rules.** The `capsule_sessions` block was added to `firestore.rules` and `src/firestore.rules`. This repo's
   `firebase.json` has no Firestore section, so copy the rules into the Firebase console (Firestore → Rules → Publish) or deploy them with your usual process.
   Without them, creating a capsule and every crew submission is rejected. Crews must send exactly four answers.
2. **Give the server a Gemini API key** for the two AI steps. Set `GEMINI_API_KEY` as an App Hosting secret/environment variable and redeploy
   (`src/ai/genkit.ts` reads it). Without it the screen shows "The AI is not configured on the server", and everything else still works.
3. Sign in at `/admin/login`, open `/admin/capsule` and **create a capsule** (set the expected number of crews, default 25).
4. **Rehearse** with `/capsule/DEMO/screen` (use "+ Sample crew") and a real phone on `/capsule/<CODE>`, then delete the rehearsal crews or the whole capsule.
5. Open `/capsule/<CODE>/screen` on the presenter laptop, press **F** for fullscreen, and keep that tab open all event. The first QR scan switches the screen from the QR to the wall by itself (Auto).
6. Make sure the lawn has mobile signal or Wi-Fi: each submission is one ~200 KB upload.

## Good to know

- **One phone per crew.** The phone remembers a finished submission (and an unfinished draft) in its own browser, so re-scanning shows "Your crew is in!". It cannot stop a second phone, so use **Remove crew** on the screen if a crew appears twice. "Start over" on the phone is there for when you removed an entry.
- **Photos** are shrunk on the phone (about 1100 px JPEG) and stored inside the crew's Firestore document, so no Storage rules are needed. They show on screen without cropping (portrait selfies too).
- **Submissions are immutable** for the phones. Only the capsule's owner can close, delete or write the constitution.
- **Privacy.** Crew photos and answers are public to anyone who has the link (read access is open, as for the rest of this app). Delete the capsule from `/admin/capsule` after the event, or once the constitution is saved elsewhere. Consider telling people on the day that their selfie appears on the screen.
- **AI.** The prompts use only what the crews wrote (no invented facts), never name individuals, always write the company as "etisalat", and keep the constitution under 300 words. The article headings are fixed ("Our identity", "Who can join", "Our red lines", "What we cherish"; in Arabic "هويتنا", "من يمكنه الانضمام", "خطوطنا الحمراء", "ما نعتز به"). The flows are in `src/ai/flows/capsule-culture.ts`; the constitution and themes are saved on the capsule so every screen shows the same text. If the AI fails, the toolbar button can simply be pressed again.
- **Languages.** Crews can answer in English or Arabic (the answer fields auto-detect direction). The constitution can be written in either; the Arabic version is titled "دستور الجزيرة الواحدة" and renders right-to-left. Every constitution shows the other language's title as a subtitle.
- **Changing the questions.** They live in `DEFAULT_QUESTIONS` (`src/lib/capsule/types.ts`), together with the article titles. The number of questions is fixed at four: it is also enforced by the Firestore rules and the AI schema.

## Testing

- Security rules (needs Java): see the header of `scripts/capsule-rules.test.mjs` (32 checks against the local Firestore emulator).
- UI: open `/capsule/DEMO` and `/capsule/DEMO/screen`.
