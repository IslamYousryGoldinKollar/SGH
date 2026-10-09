# The two signature mini games

Both appear in the experience deck (`docs/experience/index.html`, also as
`docs/experience/the-one-island-experience.pdf`) as slides 22 and 23, right after
"The Missions on the Island", plus three tiles on the "Experience Components" slide.

## 1. Treasure Hunt & The Values Tree (physical)

The crew follows the island map and clues to find hidden crates. Each crate holds cards carrying the **names of values and of behaviours**.
The crew then hangs every card in its **correct place on the Values Tree** (a value per branch, its behaviours hanging from it).

Open items (shown as dashed "to be confirmed" pills in the deck):
- the real list of etisalat values and behaviours (the deck uses clearly-labelled sample content);
- scoring, time limit and what the crew wins (resource) from this mission.

## 2. Trivia Clans (digital)

A trivia game between **2 teams**: knowledge earns a land, speed takes it. Phones join by QR code or PIN and pick a team,
answer multiple-choice questions, and claim lands on a shared hex map on the big screen.
This is the existing "Care Clans" game in this repo (`src/app/game/[gameId]`, big screen `src/app/admin/display/[gameId]`).

### What the app does today (read from the code, not run)
- 2 teams (defaults "Team Alpha" / "Team Bravo", capacity 10 each); host starts and ends the game from the big screen.
- Same ordered multiple-choice questions for everyone, each player at their own pace; one total timer (default 5 min), no per-question timer.
- A correct answer gives the team +1 and the player a land credit; the player then has ~10 seconds to tap a land on the 22-hex map.
- The winner is the team with more **points**; lands are cosmetic.

### Gaps against the deck's description ("lands change colour as the teams win them from each other")
- **Stealing lands is not implemented**: only empty lands can be claimed (`src/lib/gameService.ts` has a "can add steal logic later" note). Decide whether the winner should be points or lands held.
- No time bonus: speed only matters through how many questions a player gets through and who taps a free land first.
- Starting from the big screen does not generate questions; questions must be saved in the host's session editor first.
- No player sign-in is created anywhere in this repo (`signInAnonymously` is never called); joining depends on auth set up outside it. Verify on the live app.
- Known rough edges: dead "starting" status and countdown, phone "Play Again" is a no-op, late joiners stay on "Joining…", a possible question-index race right after the feedback overlay, and unused emoji components.
- `workspace/` is a stale copy of the app and breaks `next build` (type error).
