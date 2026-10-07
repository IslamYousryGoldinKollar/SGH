# Dashboard training deck

`build_training_deck.py` builds the 27-slide **Dashboard Training** deck for customer-service agents
(python-pptx, 16:9, black canvas to match the Zyda cover).

```bash
pip install python-pptx
python build_training_deck.py                      # -> output/Zyda_Dashboard_Training.pptx
python build_training_deck.py --list               # every screenshot slot + what it should show
python build_training_deck.py --placeholders-only  # blank template, every slot is a placeholder
```

Other options: `--screenshots DIR`, `--out FILE`, `--header TEXT` (the small running header, default `RING`),
`--logo FILE` (use the real Zyda logo instead of the drawn wordmark).

## How screenshots work

Each slot has a fixed file name (`01_login`, `02_orders_incoming`, …; run `--list`). Put a PNG/JPG with that
name in `screenshots/` and re-run:

* **file found** → the screenshot is placed, with its numbered call-outs (and highlight boxes where used);
* **file missing** → a dashed placeholder frame shows the file name to drop in and what to capture.

Call-outs are stored as fractions of the original screenshot, so a re-captured screenshot of the same screen
keeps its call-outs in place. The numbers on a screenshot match the numbered steps beside it.

Slots 38–41 have no screenshot yet (existing customer found, removing an ingredient, the schedule-slot
picker, a pick-up order on the dashboard) and stay placeholders until you add the files.

## Structure

| Slides | Section |
|---|---|
| 1–2 | Cover, agenda |
| 3–4 | 01 Login & security |
| 5–8 | 02 Dashboard overview (agent journey, order drop-in, fully recorded order, customer panel) |
| 9–11 | 03 Customer data (phone number, new customer, new vs existing) |
| 12–16 | 04 Address registration (location taken twice, four steps) |
| 17–20 | 05 Menu navigation & items (search, options, add/remove ingredients, sold out) |
| 21–23 | 06 Pick-up orders (branch, branch list, date & time) |
| 24–26 | 07 Checkout & payment (Cash / Online, voucher, review & place order) |
| 27 | Before-you-place-an-order checklist |

Every slide carries speaker notes. Edit the content in `deck_spec()` in the script.

## Privacy

Several of the dashboard screenshots show real customer names, phone numbers and addresses, so
`screenshots/` and `output/` are git-ignored. Blur or replace those before the deck is shared widely.
