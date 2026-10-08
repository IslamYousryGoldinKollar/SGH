# Dashboard training deck

`build_training_deck.py` builds the **Dashboard Training** deck for customer-service agents
(python-pptx, 16:9, 36 slides). The text is Egyptian Arabic, with the dashboard's English UI terms kept
exactly as they appear on screen. The layout reads right to left. The cover keeps the black Zyda
design; the rest is a light theme with one colour per section.

```bash
pip install python-pptx
python build_training_deck.py                      # -> output/Zyda_Dashboard_Training.pptx
python build_training_deck.py --list               # every screenshot slot + what it should show
python build_training_deck.py --placeholders-only  # blank template, every slot is a placeholder
```

Other options:

* `--screenshots DIR`, `--out FILE`
* `--header TEXT`: the small running header (default `RING`)
* `--logo FILE`: use the real Zyda logo instead of the drawn wordmark
* `--ltr`: mirror the layout left to right

## How screenshots work

Each slot has a fixed file name (`01_login`, `45_switch_store`, …; run `--list`). Put a PNG or JPG with
that name in `screenshots/` and re-run:

* **file found:** the screenshot is placed with its numbered call-outs and any highlight boxes;
* **file missing:** a dashed placeholder frame shows the file name to drop in and what to capture.

Call-outs are stored as fractions of the original screenshot, so a re-captured screenshot of the same
screen keeps its call-outs in place. The numbers on a screenshot match the numbered steps beside it.

All 41 slots the deck uses are filled with real photos, so no placeholders are drawn. Delete or rename a
file to get its placeholder back, for example to re-capture a screen. The cashback slide shows the three
brand logos (`48_logo_maine`, `49_logo_chickin_worx`, `50_logo_vinnys_pizza`) and two checkouts: Maine on
Cash (`51_cashback_cash`) and an online brand on Credit Card (`42_cashback_checkout`).

## Structure (follows the order workflow)

| Slides | Section |
|---|---|
| 1–3 | Cover, agenda, the 5-step order journey |
| 4–7 | 01 الدخول واختيار البراند: login, never share the login, select the brand (Switch Store) |
| 8–11 | 02 بيانات العميل: phone number, new customer, new vs existing |
| 12–26 | 03 تنفيذ الأوردر: last order (Order again + Rewards), search by first letters, item options, Special Instructions, sold out, delivery vs pickup, location taken twice (4 steps), pickup branch, branch list, pickup time (Pickup Time screen; restaurants without Schedule: write the time in Special Instructions) |
| 27–31 | 04 المراجعة والدفع: review with the customer, Cash vs Online (Maine: cash only), cashback (Maine: paid in cash; Vinnys Pizza and Chickin Worx: paid online), voucher |
| 32–35 | 05 تأكيد الأوردر: complete the checkout (Place Order / Send Cart Link), order lands on the dashboard, accepted order (branch, customer data, order number) |
| 36 | Checklist |

Every slide has speaker notes. Edit the content in `deck_spec()`: UI terms go between `**…**`, and
the script draws them in the section colour. Avoid brackets, `+` and digit ranges next to English
words in Arabic sentences, because the right-to-left layout can reorder them.

Fonts: Arial for both Latin and Arabic; Windows and macOS ship Arabic glyphs in Arial.

## Privacy

Several of the dashboard screenshots show real customer names, phone numbers and addresses, so
`screenshots/` and `output/` are git-ignored. Blur or replace those before the deck is shared widely.
