# The Culture Capsule (ice-breaker QR game)

Part of **The One Island** team-building experience (e& Egypt). The updated experience deck is in
[`docs/experience/index.html`](experience/index.html) (slides 12-16 and 30).

## What happens on the day

1. The icebreaker ends with crews of **8** (a leader and 7 followers). About 200 people make about 25 crews.
2. The big screen shows **one QR code**. Each crew's **leader scans it once**.
3. The leader reads each of the three questions out loud. The crew agrees on one answer together, and the leader types it:
   1. What is the top thing you appreciate in our culture?
   2. What differentiates us, as a culture, from other companies?
   3. What do you wish would magically disappear from our culture?
4. The crew takes a **group selfie** and sends everything.
5. The big screen fills **live**: a spotlight rotates through the crews (answers and group photo), with every selfie in a strip below.
6. The AI **groups the answers into themes**, then **writes one letter to the future managers**: what e& is, what defines its culture, and what they need to do to keep it unique and successful. The letter is revealed page by page on the big screen, and a printable page is available.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/admin/capsule` | Admin (signed in) | Create a capsule, get the phone link and QR, open the screen, delete |
| `/capsule/<CODE>/screen` | Presenter / projector | The big screen. The toolbar only appears for the capsule's owner |
| `/capsule/<CODE>` | Crew leader's phone | What the QR code opens |
| `/capsule/<CODE>/letter` | Anyone with the link | Printable letter with every group selfie (Print / Save as PDF) |
| `/capsule/DEMO/screen` and `/capsule/DEMO` | Rehearsal | Runs entirely in the browser (localStorage), no Firebase needed. Open both in two tabs of one browser |

Big-screen toolbar (fades after a few seconds; move the mouse to bring it back): **Auto** (QR, then wall, then letter) · **QR** (1) · **Wall** (2) ·
**Themes** (3) · **Letter** (4) · **Group answers** (AI) · **Write letter** (AI) · **EN / عربي** (language of the next AI output) ·
**Close submissions** · **Remove crew** (the crew currently in the spotlight) · **Fullscreen** (F). In the letter view, ← → / PageUp PageDown / Space (a presentation clicker) turn the pages.

## Before the event: set-up checklist

1. **Publish the Firestore rules.** The `capsule_sessions` block was added to `firestore.rules` and `src/firestore.rules`. This repo's
   `firebase.json` has no Firestore section, so copy the rules into the Firebase console (Firestore → Rules → Publish) or deploy them with your usual process.
   Without them, creating a capsule and every crew submission is rejected.
2. **Give the server a Gemini API key** for the two AI steps. Set `GEMINI_API_KEY` as an App Hosting secret/environment variable and redeploy
   (`src/ai/genkit.ts` reads it). Without it the screen shows "The AI is not configured on the server", and everything else still works.
3. Sign in at `/admin/login`, open `/admin/capsule` and **create a capsule** (set the expected number of crews, default 25).
4. **Rehearse** with `/capsule/DEMO/screen` (use "+ Sample crew") and a real phone on `/capsule/<CODE>`, then delete the rehearsal crews or the whole capsule.
5. Open `/capsule/<CODE>/screen` on the presenter laptop, press **F** for fullscreen, and keep that tab open all event. The first QR scan switches the screen from the QR to the wall by itself (Auto).
6. Make sure the lawn has mobile signal or Wi-Fi: each submission is one ~200 KB upload.

## Good to know

- **One phone per crew.** The phone remembers a finished submission (and an unfinished draft) in its own browser, so re-scanning shows "Your crew is in!". It cannot stop a second phone, so use **Remove crew** on the screen if a crew appears twice. "Start over" on the phone is there for when you removed an entry.
- **Photos** are shrunk on the phone (about 1100 px JPEG) and stored inside the crew's Firestore document, so no Storage rules are needed. They show on screen without cropping (portrait selfies too).
- **Submissions are immutable** for the phones. Only the capsule's owner can close, delete or write the letter.
- **Privacy.** Crew photos and answers are public to anyone who has the link (read access is open, as for the rest of this app). Delete the capsule from `/admin/capsule` after the event, or once the letter is saved elsewhere. Consider telling people on the day that their selfie appears on the screen.
- **AI.** The prompts use only what the crews wrote (no invented facts), never name individuals, and keep the letter under 280 words. The flows are in `src/ai/flows/capsule-culture.ts`; the letter and themes are saved on the capsule so every screen shows the same text. If the AI fails, the toolbar button can simply be pressed again.
- **Languages.** Crews can answer in English or Arabic (the answer fields auto-detect direction). The letter can be written in either; Arabic letters render right-to-left.

## Testing

- Security rules (needs Java): see the header of `scripts/capsule-rules.test.mjs` (31 checks against the local Firestore emulator).
- UI: open `/capsule/DEMO` and `/capsule/DEMO/screen`.
