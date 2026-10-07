#!/usr/bin/env python3
"""Build the Zyda "Dashboard Training" deck for customer-service agents.

    python build_training_deck.py                      # uses ./screenshots, writes ./output/...pptx
    python build_training_deck.py --list               # print every screenshot slot and what it should show
    python build_training_deck.py --placeholders-only  # blank template: every slot is a placeholder

How screenshots work
--------------------
Every screenshot slot has a file name (see --list), e.g. ``01_login``.  If a PNG/JPG with that name exists
in the screenshots folder it is placed on the slide together with its numbered call-outs; if not, a dashed
placeholder frame is drawn that tells you exactly which file to drop in.  Re-run the script to refresh the deck.

The numbered circles on a screenshot match the numbered steps next to it.  Call-out positions are stored as
fractions of the *original* screenshot, so replacing a screenshot with a re-captured one of the same screen
keeps the call-outs in the right place.

Requires: python-pptx (pip install python-pptx).  Pillow is installed together with it.
"""
from __future__ import annotations

import argparse
import io
import math
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from PIL import Image, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Emu, Inches, Pt

# --------------------------------------------------------------------------------------
# Design tokens (taken from the supplied cover: black canvas, white Helvetica-style type)
# --------------------------------------------------------------------------------------
SLIDE_W, SLIDE_H = 13.333, 7.5
MX = 0.8  # left/right margin
CONTENT_W = SLIDE_W - 2 * MX
TITLE_Y = 0.82
CONTENT_TOP = 1.95
CONTENT_BOTTOM = 7.0

FONT = "Arial"
RUNNING_HEADER = "RING"  # small label centred at the top of every slide (as on the supplied cover)

BG = "000000"
FG = "FFFFFF"
MUTED = "A8A8A8"
DIM = "6B6B6B"
RULE = "2A2A2A"
PANEL = "121212"
ACCENT = "234DFB"  # Zyda blue, sampled from the login screen
ACCENT_TEXT = "7B9BFF"  # lighter blue for small text on black
WARN = "E5484D"
GOOD = "3DD68C"

SMAX = 0.0125  # max inches per screenshot pixel (avoids blowing small crops up too far)
FONT_FILES = {
    False: [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ],
    True: [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ],
}


def rgb(hex_: str) -> RGBColor:
    return RGBColor.from_string(hex_)


# --------------------------------------------------------------------------------------
# Text measuring (so step lists can be laid out without guessing)
# --------------------------------------------------------------------------------------
_font_cache: Dict[bool, Optional[ImageFont.FreeTypeFont]] = {}


def _measure_font(bold: bool) -> Optional[ImageFont.FreeTypeFont]:
    if bold not in _font_cache:
        font = None
        for path in FONT_FILES[bold]:
            if os.path.exists(path):
                try:
                    font = ImageFont.truetype(path, 200)
                    break
                except OSError:
                    pass
        _font_cache[bold] = font
    return _font_cache[bold]


def text_width(text: str, size: float, bold: bool = False) -> float:
    """Width of one line of text in inches."""
    font = _measure_font(bold)
    if font is None:
        return len(text) * size * 0.54 / 72
    return font.getlength(text) / 200 * size / 72


def count_lines(text: str, size: float, bold: bool, width: float) -> int:
    lines = 0
    for para in text.split("\n"):
        words = para.split(" ")
        cur = ""
        n = 1
        for w in words:
            trial = (cur + " " + w).strip()
            if text_width(trial, size, bold) <= width or not cur:
                cur = trial
            else:
                n += 1
                cur = w
        lines += n
    return lines


# --------------------------------------------------------------------------------------
# Screenshot registry.  key -> (file stem, (width px, height px), caption, what the slot should show)
# Sizes are the real screenshot sizes; they keep placeholder frames the same shape as the real thing.
# --------------------------------------------------------------------------------------
SHOT_TABLE = [
    ("login", "01_login", (1357, 601), "Login screen",
     'The login page ("Login to your store") with the Email Address and Password fields and the Login button.'),
    ("orders_incoming", "02_orders_incoming", (1100, 464), "A new order lands on the dashboard",
     "The dashboard order list with a new order card: header row (time, order ID, customer, type, payment, requested time, status), items on the left, customer on the right."),
    ("order_full", "03_order_full", (1093, 557), "A fully recorded order",
     "A complete order card: items with their options, price breakdown, customer, address, map, Ready button and the status log line."),
    ("order_customer_map", "04_order_customer_map", (528, 423), "Customer panel of an order",
     "Close-up of the customer panel: name, order ID, phone with copy / WhatsApp icons, address, and the map with branch and customer pins."),
    ("phone_entry", "05_phone_entry", (392, 153), "Select Customer",
     'The "Select Customer" window with the Phone Number field (+20 pre-filled).'),
    ("customer_new", "06_customer_new", (408, 290), "Number not registered yet",
     'Select Customer after typing an unregistered number: "This looks like a new customer" and the Add Customer button.'),
    ("customer_details", "07_customer_details", (404, 348), "Complete Info (new customer)",
     'The "Complete Info." form: Phone Number, Full Name and Save.'),
    ("customer_save", "08_customer_save", (392, 55), "Save",
     "The red Save button once the name is valid."),
    ("saved_addresses", "09_saved_addresses", (409, 636), "Select Address with saved addresses",
     "Checkout with the Select Address window open: Add new address button and the customer's saved addresses."),
    ("map_empty", "10_map_empty", (404, 643), "Order Mode map",
     "Order Mode with the Delivery / Pickup tabs and the empty Enter Location map."),
    ("map_search", "11_map_search", (441, 643), "Search and pick the suggestion",
     "Order Mode map after typing an address or coordinates, with the suggestion list showing."),
    ("map_save", "12_map_save", (441, 643), "Pin placed - Save",
     "Order Mode map with the pin placed and the red Save button."),
    ("not_deliverable", "13_not_deliverable", (392, 55), "Outside the delivery area",
     'The "We don\'t deliver to this address" button state.'),
    ("search_results", "14_search_results", (416, 633), "Search results",
     "Menu search results for a short search term: name, price, description and photo for each item."),
    ("menu_search", "15_menu_search", (402, 122), "Search bar and Menu",
     "The Search bar at the top of the menu."),
    ("basket_checkout", "16_basket_checkout", (397, 572), "Basket with Checkout",
     "The basket (Your Items) with the Add Items and Checkout buttons at the bottom."),
    ("checkout_bar", "17_checkout_bar", (380, 96), "Bottom bar once an item is in the basket",
     "The bottom bar with the discount progress line, Add Items and Checkout."),
    ("checkout_add_address", "18_checkout_add_address", (391, 218), 'Checkout: "Please add an address"',
     'The Deliver to block on checkout showing "Please add an address" in red.'),
    ("add_new_address_btn", "19_add_new_address_btn", (380, 55), "Add new address",
     "The red Add new address button."),
    ("map_second_location", "20_map_second_location", (409, 643), "Location window (second time)",
     "The location window that opens from Add new address: Enter Location search, map with pin, Save."),
    ("edit_location", "21_edit_location", (380, 128), "Edit Location",
     "The Edit Location strip at the top of the address form."),
    ("address_form", "22_address_form", (407, 643), "Address form",
     "The address form: House / Apartment / Office, City, Area, Street, Building, Floor, Apartment Number, Notes, Add new address."),
    ("item_options", "23_item_options", (407, 643), "Item window",
     "An open item: name, description, Size, a Required option group, quantity and the Add Item button."),
    ("basket_items", "24_basket_items", (354, 132), "Item in Your Items",
     "The item inside the basket with its chosen option and quantity stepper."),
    ("order_item_options", "25_order_item_options", (527, 552), "Options and extras as recorded on an order",
     "An order's items list showing option groups (e.g. Choose your bagel, Milk) and an Extra with its price."),
    ("sold_out_list", "26_sold_out_list", (407, 643), "Category with sold-out items",
     "A menu category with one normal item, greyed-out Sold out items and a scheduled-only item."),
    ("sold_out_item", "27_sold_out_item", (392, 105), "Sold out item",
     "A single item row with the Sold out tag."),
    ("pickup_branches", "28_pickup_branches", (409, 643), "Pickup: Select Branch",
     "Order Mode with Pickup chosen and the Select Branch list (name, distance, address)."),
    ("pickup_branch_card", "29_pickup_branch_card", (367, 164), "Selected pick-up branch",
     "The Pickup Branch card with the map pin."),
    ("pickup_time", "30_pickup_time", (392, 157), "Pick-up time",
     'Pickup selected: "Picking up from <branch>" and "Ready in 15 minutes - ASAP" with the Schedule slot button.'),
    ("payment_place_order", "31_payment_place_order", (367, 163), "Pay with",
     "The Pay with block (Cash / Credit Card) and the Place Order button."),
    ("payment_options", "32_payment_options", (361, 110), "Pay with",
     "The Pay with block (Cash / Credit Card)."),
    ("checkout_full", "33_checkout_full", (400, 638), "Full checkout page",
     "The whole checkout page: Deliver to, time, Save on this order (Voucher), Order Summary, Place Order."),
    ("voucher_box", "34_voucher_box", (367, 76), "Voucher box",
     'The "Save on this order" box with the Voucher field and Apply.'),
    ("voucher_code", "35_voucher_code", (364, 68), "Voucher code",
     'The "Have a code?" voucher field.'),
    ("summary_delivery", "36_summary_delivery", (367, 143), "Order Summary - delivery",
     "Order Summary of a delivery order: Subtotal, Delivery Services, Service Fee, Total."),
    ("summary_pickup", "37_summary_pickup", (367, 120), "Order Summary - pick-up",
     "Order Summary of a pick-up order (no delivery line)."),
    # Slots that have no screenshot yet - they stay placeholders until you add the file.
    ("customer_existing", "38_customer_existing", (408, 290), "Existing customer found",
     "Select Customer after typing a number that IS registered: the existing customer shows and you can continue."),
    ("ingredient_remove", "39_ingredient_remove", (400, 243), "Removing an ingredient",
     "An item window with removable ingredients: the ingredient deselected / the 'no ...' option chosen."),
    ("schedule_slot_picker", "40_schedule_slot_picker", (392, 290), "Schedule slot",
     "The Schedule slot picker where a pick-up date and time are chosen."),
    ("pickup_order_recorded", "41_pickup_order_recorded", (520, 250), "A pick-up order on the dashboard",
     "A pick-up order card on the dashboard showing the branch and the requested pick-up date and time."),
]
SHOTS = {k: dict(file=f, size=s, caption=c, show=d) for k, f, s, c, d in SHOT_TABLE}


@dataclass
class Use:
    """One placement of a screenshot slot on a slide."""

    key: str
    marks: Sequence[Tuple[int, float, float]] = ()  # (step number, x, y) as fractions of the ORIGINAL image
    boxes: Sequence[Tuple[float, float, float, float]] = ()  # highlight rectangles, original-image fractions
    crop: Optional[Tuple[float, float, float, float]] = None  # visible part (x0, y0, x1, y1), original fractions
    cap: Optional[str] = None  # caption override ('' hides the caption)


def U(key, marks=(), boxes=(), crop=None, cap=None):
    return Use(key, tuple(marks), tuple(boxes), crop, cap)


# --------------------------------------------------------------------------------------
# Build context
# --------------------------------------------------------------------------------------
class Ctx:
    def __init__(self, shots_dir: str, placeholders_only: bool, header: str, logo: Optional[str]):
        self.shots_dir = shots_dir
        self.placeholders_only = placeholders_only
        self.header = header
        self.logo = logo
        self.found: List[str] = []
        self.missing: List[str] = []
        self._dims: Dict[str, Tuple[int, int]] = {}
        self.section_first_page: Dict[int, int] = {}

    def path(self, key: str) -> Optional[str]:
        if self.placeholders_only:
            return None
        stem = SHOTS[key]["file"]
        for ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"):
            p = os.path.join(self.shots_dir, stem + ext)
            if os.path.exists(p):
                return p
        return None

    def full_size(self, key: str) -> Tuple[int, int]:
        p = self.path(key)
        if p:
            if p not in self._dims:
                with Image.open(p) as im:
                    self._dims[p] = im.size
            return self._dims[p]
        return SHOTS[key]["size"]

    def dims(self, use: Use) -> Tuple[float, float]:
        w, h = self.full_size(use.key)
        if use.crop:
            x0, y0, x1, y1 = use.crop
            return w * (x1 - x0), h * (y1 - y0)
        return float(w), float(h)

    def note(self, key: str, found: bool) -> None:
        bucket = self.found if found else self.missing
        if key not in bucket:
            bucket.append(key)


# --------------------------------------------------------------------------------------
# Drawing helpers
# --------------------------------------------------------------------------------------
def I(v: float) -> Emu:
    return Inches(v)


def add_text(slide, x, y, w, h, paras, anchor="t", wrap=True):
    """paras: list of dicts(text|runs, size, bold, color, align, after, spacing)."""
    box = slide.shapes.add_textbox(I(x), I(y), I(w), I(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    first = True
    for p in paras:
        para = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        para.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[p.get("align", "l")]
        if p.get("after") is not None:
            para.space_after = Pt(p["after"])
        if p.get("spacing"):
            para.line_spacing = p["spacing"]
        runs = p.get("runs") or [(p.get("text", ""), {})]
        for text, style in runs:
            r = para.add_run()
            r.text = text
            f = r.font
            f.name = FONT
            f.size = Pt(style.get("size", p.get("size", 12)))
            f.bold = style.get("bold", p.get("bold", False))
            f.italic = style.get("italic", p.get("italic", False))
            f.color.rgb = rgb(style.get("color", p.get("color", FG)))
    return box


def P(text, size=12, bold=False, color=FG, align="l", after=None, spacing=None, italic=False):
    return dict(text=text, size=size, bold=bold, color=color, align=align, after=after, spacing=spacing, italic=italic)


def add_rect(slide, x, y, w, h, fill=None, line=None, line_w=1.0, rounded=0.0, dash=False, shape=None):
    st = shape or (MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE)
    s = slide.shapes.add_shape(st, I(x), I(y), I(w), I(h))
    if rounded and shape is None:
        s.adjustments[0] = min(0.5, rounded / max(0.01, min(w, h)))
    if fill:
        s.fill.solid()
        s.fill.fore_color.rgb = rgb(fill)
    else:
        s.fill.background()
    if line:
        s.line.color.rgb = rgb(line)
        s.line.width = Pt(line_w)
        if dash:
            s.line.dash_style = MSO_LINE.DASH
    else:
        s.line.fill.background()
    s.shadow.inherit = False
    return s


def add_line(slide, x1, y1, x2, y2, color=RULE, w=0.75):
    ln = slide.shapes.add_connector(1, I(x1), I(y1), I(x2), I(y2))
    ln.line.color.rgb = rgb(color)
    ln.line.width = Pt(w)
    return ln


def badge(slide, cx, cy, n, d=0.3, size=11, fill=ACCENT, ring=True):
    o = add_rect(slide, cx - d / 2, cy - d / 2, d, d, fill=fill, line=FG if ring else None, line_w=1.25, shape=MSO_SHAPE.OVAL)
    tf = o.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(n)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.color.rgb = rgb(FG)
    return o


# --------------------------------------------------------------------------------------
# Slide chrome
# --------------------------------------------------------------------------------------
def new_slide(prs, ctx: Ctx, page: int, notes: str = ""):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = rgb(BG)
    if ctx.header:
        add_text(s, SLIDE_W / 2 - 1.5, 0.32, 3.0, 0.2, [P(ctx.header, 8, color=FG, align="c")])
    add_text(s, SLIDE_W - MX - 0.8, 0.32, 0.8, 0.2, [P(str(page), 8, color=FG, align="r")])
    if notes:
        s.notes_slide.notes_text_frame.text = notes
    return s


SECTIONS = {
    1: "Login & Security",
    2: "Dashboard Overview",
    3: "Customer Data",
    4: "Address Registration",
    5: "Menu Navigation & Items",
    6: "Pick-up Orders",
    7: "Checkout & Payment",
}


def title_block(slide, title: str, sec: Optional[int]):
    add_text(slide, MX, TITLE_Y, 8.6, 1.0, [P(title.upper(), 25, bold=True, spacing=1.0)])
    if sec:
        add_text(slide, 10.0, TITLE_Y + 0.07, SLIDE_W - MX - 10.0, 0.6, [
            P(f"SECTION {sec:02d}", 8, color=DIM, after=2),
            P(SECTIONS[sec], 11, color=MUTED),
        ])


def wordmark(slide, cx, cy, em_pt: float, ctx: Ctx):
    """Zyda wordmark: ◂ zyda ▸ (vector) - or a supplied logo image."""
    if ctx.logo and os.path.exists(ctx.logo):
        with Image.open(ctx.logo) as im:
            ar = im.width / im.height
        h = em_pt / 72 * 1.1
        slide.shapes.add_picture(ctx.logo, I(cx - h * ar / 2), I(cy - h / 2), I(h * ar), I(h))
        return
    em = em_pt / 72
    tw = text_width("zyda", em_pt, True)
    tri_h = em * 0.50
    tri_w = tri_h * 0.86
    gap = em * 0.17
    total = tri_w + gap + tw + gap + tri_w
    x0 = cx - total / 2
    top = cy - em * 0.645  # puts the x-height centre of the text on cy
    add_text(slide, x0 + tri_w + gap - 0.02, top, tw + 0.3, em * 1.3, [P("zyda", em_pt, bold=True, spacing=1.0)], wrap=False)
    # an isosceles triangle points up; rotating 270 / 90 degrees makes it point left / right.
    # The un-rotated frame is tri_h wide and tri_w tall, centred on the slot.
    for rot, slot_cx in ((270, x0 + tri_w / 2), (90, x0 + total - tri_w / 2)):
        t = add_rect(slide, slot_cx - tri_h / 2, cy - tri_w / 2, tri_h, tri_w, fill=FG, shape=MSO_SHAPE.ISOSCELES_TRIANGLE)
        t.rotation = rot
    add_text(slide, x0 + total + 0.04, cy - em * 0.62, 0.4, 0.2, [P("TM", max(6, em_pt * 0.1), color=FG)], wrap=False)


# --------------------------------------------------------------------------------------
# Screenshots: layout + drawing
# --------------------------------------------------------------------------------------
def fit_size(text: str, width: float, start=14.0, floor=9.0) -> float:
    size = start
    while size > floor and text_width(text, size, True) > width:
        size -= 0.5
    return size


def draw_placeholder(slide, key: str, x, y, w, h):
    shot = SHOTS[key]
    add_rect(slide, x, y, w, h, fill=PANEL, line=MUTED, line_w=1.25, dash=True, rounded=0.06)
    fname = shot["file"] + ".png"
    if h < 1.0 or w < 2.2:
        add_text(slide, x + 0.1, y, w - 0.2, h, [
            P(f"PLACEHOLDER  ·  {fname}", 9, bold=True, color=ACCENT_TEXT, align="c"),
        ], anchor="m")
        return
    paras = [
        P("SCREENSHOT PLACEHOLDER", 9, bold=True, color=ACCENT_TEXT, align="c", after=4),
        P(fname, fit_size(fname, w - 0.5), bold=True, align="c", after=6),
        P("Show: " + shot["show"], 10.5, color=MUTED, align="c"),
    ]
    add_text(slide, x + 0.25, y + 0.1, w - 0.5, h - 0.2, paras, anchor="m")


def draw_use(slide, ctx: Ctx, use: Use, x, y, w, h, show_caption_h: float = 0.0):
    p = ctx.path(use.key)
    ctx.note(use.key, bool(p))
    if p:
        pic = slide.shapes.add_picture(p, I(x), I(y), I(w), I(h))
        if use.crop:
            x0, y0, x1, y1 = use.crop
            pic.crop_left, pic.crop_top, pic.crop_right, pic.crop_bottom = x0, y0, 1 - x1, 1 - y1
        pic.line.color.rgb = rgb("3A3A3A")
        pic.line.width = Pt(0.75)

        def to_local(fx, fy):
            if use.crop:
                x0, y0, x1, y1 = use.crop
                return (fx - x0) / (x1 - x0), (fy - y0) / (y1 - y0)
            return fx, fy

        for bx0, by0, bx1, by1 in use.boxes:
            lx0, ly0 = to_local(bx0, by0)
            lx1, ly1 = to_local(bx1, by1)
            lx0, ly0, lx1, ly1 = max(0, lx0), max(0, ly0), min(1, lx1), min(1, ly1)
            if lx1 > lx0 and ly1 > ly0:
                add_rect(slide, x + lx0 * w, y + ly0 * h, (lx1 - lx0) * w, (ly1 - ly0) * h,
                         line=ACCENT, line_w=2.25, rounded=0.05)
        for n, fx, fy in use.marks:
            lx, ly = to_local(fx, fy)
            if -0.02 <= lx <= 1.02 and -0.02 <= ly <= 1.02:
                badge(slide, x + lx * w, y + ly * h, n, d=0.27, size=10.5)
    else:
        draw_placeholder(slide, use.key, x, y, w, h)
    cap = SHOTS[use.key]["caption"] if use.cap is None else use.cap
    if cap and show_caption_h:
        add_text(slide, x, y + h + 0.06, max(w, 1.6), show_caption_h, [P(cap, 9, color=MUTED, italic=True)])


def layout_rows(ctx: Ctx, slide, rows: List[List[Use]], box, flow: str = "", gap_h=0.3, gap_v=0.32, cap_h=0.30):
    """Place rows of screenshots inside box=(x, y, w, h).  Each row is scaled on its own, then everything is
    shrunk together if the stack is too tall.  Rows are centred in the box."""
    bx, by, bw, bh = box
    info = []
    for row in rows:
        dims = [ctx.dims(u) for u in row]
        sumw = sum(d[0] for d in dims)
        maxh = max(d[1] for d in dims)
        s = min((bw - (len(row) - 1) * gap_h) / sumw, SMAX)
        has_cap = any((SHOTS[u.key]["caption"] if u.cap is None else u.cap) for u in row)
        info.append(dict(row=row, dims=dims, s=s, maxh=maxh, cap=cap_h if has_cap else 0.0))
    fixed = (len(rows) - 1) * gap_v + sum(r["cap"] for r in info)
    tot = sum(r["s"] * r["maxh"] for r in info)
    f = min(1.0, max(0.2, (bh - fixed) / tot)) if tot else 1.0
    total_h = tot * f + fixed
    y = by + max(0.0, (bh - total_h) * 0.4)
    for ri, r in enumerate(info):
        s = r["s"] * f
        row_w = sum(d[0] for d in r["dims"]) * s + (len(r["row"]) - 1) * gap_h
        x = bx + (bw - row_w) / 2
        row_h = r["maxh"] * s
        for ui, (use, d) in enumerate(zip(r["row"], r["dims"])):
            w, h = d[0] * s, d[1] * s
            yy = y + (row_h - h) / 2
            draw_use(slide, ctx, use, x, yy, w, h, r["cap"])
            if flow and ui < len(r["row"]) - 1 and "h" in flow:
                add_text(slide, x + w, yy + h / 2 - 0.16, gap_h, 0.3, [P("→", 16, color=ACCENT_TEXT, align="c")], anchor="m")
            x += w + gap_h
        if flow and ri < len(info) - 1 and "v" in flow:
            add_text(slide, bx, y + row_h + r["cap"] - 0.02, bw, gap_v, [P("↓", 15, color=ACCENT_TEXT, align="c")], anchor="m")
        y += row_h + r["cap"] + gap_v


def place(slide, ctx, rows, box, flow=""):
    layout_rows(ctx, slide, rows, box, flow)


# --------------------------------------------------------------------------------------
# Banners (tip / warning) and step lists
# --------------------------------------------------------------------------------------
BANNER = {
    "tip": ("TIP", ACCENT_TEXT, ACCENT),
    "warn": ("WATCH OUT", "FF7A7E", WARN),
    "must": ("ALWAYS", "FF7A7E", WARN),
    "note": ("GOOD TO KNOW", MUTED, DIM),
}


def banner_height(text: str, width: float, size=11.5) -> float:
    return count_lines(text, size, False, width - 0.4) * size * 1.25 / 72 + 0.52


def draw_banner(slide, kind: str, text: str, x, y, w, size=11.5):
    label, tcolor, bar = BANNER[kind]
    h = banner_height(text, w, size)
    add_rect(slide, x, y, w, h, fill="141414")
    add_rect(slide, x, y, 0.07, h, fill=bar)
    add_text(slide, x + 0.25, y + 0.13, w - 0.4, 0.2, [P(label, 8, bold=True, color=tcolor)])
    add_text(slide, x + 0.25, y + 0.33, w - 0.4, h - 0.35, [P(text, size, spacing=1.05)])
    return h


STEP_SIZES = ((14, 11.5), (13, 10.5), (12, 10), (11, 9.5))
STEP_GAP = 0.17
BADGE = 0.3


def measure_steps(steps, width):
    tw = width - BADGE - 0.15
    for t_sz, d_sz in STEP_SIZES:
        hs = []
        for title, detail in steps:
            h = count_lines(title, t_sz, True, tw) * t_sz * 1.2 / 72
            if detail:
                h += 0.04 + count_lines(detail, d_sz, False, tw) * d_sz * 1.22 / 72
            hs.append(h)
        total = sum(hs) + STEP_GAP * (len(steps) - 1)
        yield t_sz, d_sz, hs, total


def draw_steps(slide, steps, x, y, width, avail_h):
    chosen = None
    for t_sz, d_sz, hs, total in measure_steps(steps, width):
        chosen = (t_sz, d_sz, hs, total)
        if total <= avail_h:
            break
    t_sz, d_sz, hs, total = chosen
    tw = width - BADGE - 0.15
    cy = y
    for i, ((title, detail), h) in enumerate(zip(steps, hs), 1):
        badge(slide, x + BADGE / 2, cy + t_sz * 1.2 / 72 / 2 + 0.01, i, d=BADGE, size=11, ring=False)
        paras = [P(title, t_sz, bold=True, spacing=1.0, after=2 if detail else 0)]
        if detail:
            paras.append(P(detail, d_sz, color=MUTED, spacing=1.0))
        add_text(slide, x + BADGE + 0.15, cy, tw, h + 0.05, paras)
        cy += h + STEP_GAP
    return cy - STEP_GAP


# --------------------------------------------------------------------------------------
# Slide kinds
# --------------------------------------------------------------------------------------
def k_cover(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    add_text(s, MX, 1.38, 6.5, 1.2, [P("DASHBOARD", 28, bold=True, spacing=1.0), P("TRAINING", 28, bold=True, spacing=1.0)])
    add_text(s, 10.06, 1.52, 2.5, 0.3, [P("Step by step", 10)])
    wordmark(s, SLIDE_W / 2, 4.05, 100, ctx)
    return s


def k_agenda(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, "What we'll cover", None)
    y = 1.95
    row_h = 0.68
    items = spec["items"]
    for i, (sec, blurb) in enumerate(items):
        yy = y + i * row_h
        add_line(s, MX, yy, SLIDE_W - MX, yy, RULE)
        add_text(s, MX, yy + 0.14, 0.8, 0.4, [P(f"{sec:02d}", 20, bold=True, color=ACCENT_TEXT)])
        add_text(s, MX + 0.9, yy + 0.16, 3.9, 0.4, [P(SECTIONS[sec], 16, bold=True)])
        add_text(s, MX + 5.0, yy + 0.19, 5.4, 0.4, [P(blurb, 12, color=MUTED)])
        add_text(s, SLIDE_W - MX - 1.0, yy + 0.19, 1.0, 0.3, [P(f"Slide {ctx.section_first_page[sec]}", 11, color=DIM, align="r")])
    add_line(s, MX, y + len(items) * row_h, SLIDE_W - MX, y + len(items) * row_h, RULE)
    return s


def k_statement(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    sec = spec.get("sec")
    if sec:
        add_text(s, MX, TITLE_Y + 0.07, 6, 0.4, [P(f"SECTION {sec:02d}  ·  {SECTIONS[sec].upper()}", 9, color=DIM)])
    add_rect(s, MX, 2.15, 0.09, 0.95, fill=WARN)
    add_text(s, MX + 0.35, 2.05, 11.5, 1.2, [P(spec["headline"].upper(), 50, bold=True, spacing=0.95)])
    add_text(s, MX + 0.35, 3.45, 10, 0.5, [P(spec["sub"], 20, color=MUTED)])
    add_text(s, MX + 0.35, 4.55, 6, 0.3, [P("THIS INCLUDES", 9, bold=True, color=DIM)])
    n = len(spec["chips"])
    cw = (CONTENT_W - 0.35 - (n - 1) * 0.2) / n
    for i, chip in enumerate(spec["chips"]):
        x = MX + 0.35 + i * (cw + 0.2)
        add_rect(s, x, 4.95, cw, 0.85, fill=PANEL, line="333333", line_w=1, rounded=0.08)
        add_text(s, x + 0.25, 4.95, 0.4, 0.85, [P("×", 26, bold=True, color=WARN)], anchor="m")
        add_text(s, x + 0.7, 4.95, cw - 0.8, 0.85, [P(chip, 16, bold=True)], anchor="m")
    return s


def k_journey(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], spec["sec"])
    steps = spec["steps"]
    n = len(steps)
    gap = 0.18
    cw = (CONTENT_W - (n - 1) * gap) / n
    y0, h = 2.15, 3.35
    for i, (title, desc, ref) in enumerate(steps):
        x = MX + i * (cw + gap)
        last = i == n - 1
        add_rect(s, x, y0, cw, h, fill=ACCENT if last else PANEL, line=None if last else "333333", line_w=1, rounded=0.1)
        add_text(s, x + 0.2, y0 + 0.18, 1, 0.6, [P(str(i + 1), 30, bold=True, color=FG if last else ACCENT_TEXT)])
        add_text(s, x + 0.2, y0 + 0.95, cw - 0.4, 0.7, [P(title.upper(), 12.5, bold=True, spacing=1.0)])
        add_text(s, x + 0.2, y0 + 1.6, cw - 0.4, 1.3, [P(desc, 10.5, color=FG if last else MUTED, spacing=1.05)])
        add_text(s, x + 0.2, y0 + h - 0.4, cw - 0.4, 0.3, [P(ref, 9, bold=True, color=FG if last else DIM)])
        if not last:
            add_text(s, x + cw - 0.02, y0 + h / 2 - 0.2, gap + 0.04, 0.4, [P("›", 16, bold=True, color=MUTED, align="c")], anchor="m", wrap=False)
    draw_banner(s, spec["banner"][0], spec["banner"][1], MX, 5.95, CONTENT_W, 12)
    return s


def left_column(slide, ctx, spec, left_w):
    """Steps + optional inset screenshots + banner stacked in the left column; returns nothing."""
    x, top = MX, CONTENT_TOP
    banner = spec.get("banner")
    bh = banner_height(banner[1], left_w) if banner else 0
    bottom = CONTENT_BOTTOM
    if banner:
        draw_banner(slide, banner[0], banner[1], x, bottom - bh, left_w)
        bottom -= bh + 0.2
    # insets sit just above the banner
    insets = spec.get("inset", [])
    inset_h = 0
    plans = []
    for u in insets:
        w_px, h_px = ctx.dims(u)
        s_ = min(left_w / w_px, 0.0105)
        cap = SHOTS[u.key]["caption"] if u.cap is None else u.cap
        plans.append((u, w_px * s_, h_px * s_, 0.3 if cap else 0))
        inset_h += h_px * s_ + (0.3 if cap else 0) + 0.12
    steps_bottom = bottom - inset_h - (0.1 if insets else 0)
    end = draw_steps(slide, spec["steps"], x, top, left_w, steps_bottom - top)
    iy = bottom - inset_h + 0.12
    for u, w, h, ch in plans:
        draw_use(slide, ctx, u, x, iy, w, h, ch)
        iy += h + ch + 0.12


def k_side(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], spec["sec"])
    left_w = spec.get("left_w", 4.5)
    left_column(s, ctx, spec, left_w)
    rx = MX + left_w + 0.45
    place(s, ctx, spec["rows"], (rx, CONTENT_TOP - 0.1, SLIDE_W - MX - rx, CONTENT_BOTTOM - CONTENT_TOP + 0.1), spec.get("flow", ""))
    return s


def k_wide(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], spec["sec"])
    place(s, ctx, spec["rows"], (MX, 1.85, CONTENT_W, 3.35), spec.get("flow", ""))
    cols = spec["steps"]
    n = len(cols)
    gap = 0.3
    cw = (CONTENT_W - (n - 1) * gap) / n
    y = 5.35
    for i, (title, detail) in enumerate(cols):
        x = MX + i * (cw + gap)
        badge(s, x + BADGE / 2, y + 0.13, i + 1, d=BADGE, size=11, ring=False)
        add_text(s, x + BADGE + 0.12, y, cw - BADGE - 0.12, 0.3, [P(title, 12.5, bold=True)])
        add_text(s, x + BADGE + 0.12, y + 0.3, cw - BADGE - 0.12, 0.95, [P(detail, 10.5, color=MUTED, spacing=1.0)])
    if spec.get("banner"):
        draw_banner(s, spec["banner"][0], spec["banner"][1], MX, 6.5, CONTENT_W, 11)
    return s


def k_compare(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], spec["sec"])
    gap = 0.35
    pw = (CONTENT_W - gap) / 2
    bottom = 0.0
    for i, panel in enumerate(spec["panels"]):
        x = MX + i * (pw + gap)
        add_rect(s, x, CONTENT_TOP - 0.05, pw, 0.42, fill=panel.get("color", ACCENT))
        add_text(s, x + 0.2, CONTENT_TOP - 0.05, pw - 0.4, 0.42, [P(panel["label"].upper(), 12, bold=True)], anchor="m")
        place(s, ctx, [panel["row"]], (x, CONTENT_TOP + 0.5, pw, 2.45))
        by = CONTENT_TOP + 3.05
        for line in panel["bullets"]:
            lines = count_lines(line, 12, False, pw - 0.3)
            add_text(s, x, by, 0.25, 0.3, [P("•", 12, color=panel.get("color", ACCENT) if panel.get("color") != "3A3A3A" else MUTED, bold=True)])
            add_text(s, x + 0.25, by, pw - 0.25, lines * 0.21 + 0.05, [P(line, 12, spacing=1.0)])
            by += lines * 0.21 + 0.1
        bottom = max(bottom, by)
    if spec.get("banner"):
        bh = banner_height(spec["banner"][1], CONTENT_W, 11)
        y = min(max(bottom + 0.1, 6.2), 7.05 - bh)
        if y >= bottom:
            draw_banner(s, spec["banner"][0], spec["banner"][1], MX, y, CONTENT_W, 11)
        else:
            print(f"  note: banner skipped on slide {page} (no room)", file=sys.stderr)
    return s


def k_table(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], spec["sec"])
    tw = 7.6
    y = CONTENT_TOP
    cols = [(0.5, "#"), (2.9, "BRANCH"), (4.2, "LOCATION SHOWN IN THE SYSTEM")]
    x = MX
    for w, head in cols:
        add_text(s, x + (0.0 if head != "#" else 0), y, w, 0.25, [P(head, 8.5, bold=True, color=DIM)])
        x += w
    y += 0.32
    rh = 0.46
    for i, (name, addr) in enumerate(spec["rows_data"], 1):
        add_line(s, MX, y, MX + tw, y, RULE)
        add_text(s, MX, y + 0.11, 0.5, 0.3, [P(str(i), 12, bold=True, color=ACCENT_TEXT)])
        add_text(s, MX + 0.5, y + 0.11, 2.8, 0.3, [P(name, 12, bold=True)])
        add_text(s, MX + 3.4, y + 0.11, 4.3, 0.3, [P(addr, 11.5, color=MUTED)])
        y += rh
    add_line(s, MX, y, MX + tw, y, RULE)
    place(s, ctx, spec["rows"], (MX + tw + 0.5, CONTENT_TOP, SLIDE_W - MX - (MX + tw + 0.5), 2.3))
    if spec.get("banner"):
        draw_banner(s, spec["banner"][0], spec["banner"][1], MX + tw + 0.5, 4.35, SLIDE_W - MX - (MX + tw + 0.5), 11)
    if spec.get("banner2"):
        draw_banner(s, spec["banner2"][0], spec["banner2"][1], MX + tw + 0.5, 5.75, SLIDE_W - MX - (MX + tw + 0.5), 11)
    return s


def k_checklist(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, spec.get("notes", ""))
    title_block(s, spec["title"], None)
    add_text(s, 10.0, TITLE_Y + 0.07, 2.6, 0.5, [P("QUICK REFERENCE", 8, color=DIM, after=2), P("Keep this one open", 11, color=MUTED)])
    items = spec["items"]
    half = math.ceil(len(items) / 2)
    colw = (CONTENT_W - 0.5) / 2
    for idx, (text, ref) in enumerate(items):
        col, row = divmod(idx, half)
        x = MX + col * (colw + 0.5)
        y = CONTENT_TOP + row * 0.95
        add_rect(s, x, y + 0.04, 0.3, 0.3, line=ACCENT_TEXT, line_w=1.75, rounded=0.05)
        add_text(s, x + 0.55, y, colw - 0.6, 0.65, [P(text, 14, bold=True, spacing=1.0, after=2), P(ref, 9.5, color=DIM)])
    return s


KINDS = dict(cover=k_cover, agenda=k_agenda, statement=k_statement, journey=k_journey, side=k_side,
             wide=k_wide, compare=k_compare, table=k_table, checklist=k_checklist)

# --------------------------------------------------------------------------------------
# The deck itself.  Marks are (step number, x, y) as fractions of the original screenshot.
# --------------------------------------------------------------------------------------
def deck_spec() -> List[dict]:
    return [
        # 1 ------------------------------------------------------------------------------
        dict(kind="cover", notes="Welcome. This session walks through the ordering dashboard step by step: from logging in to placing a finished order. Every step has a screenshot; the numbered circles on the screenshots match the numbered steps."),
        # 2 ------------------------------------------------------------------------------
        dict(kind="agenda", notes="Seven sections, in the order you will use them on a real call.", items=[
            (1, "Sign in, and protect your login"),
            (2, "How orders drop in and what a recorded order looks like"),
            (3, "Phone number: new vs existing customer"),
            (4, "Why the location is taken twice"),
            (5, "Search, customise, sold-out items"),
            (6, "Branches, dates and times"),
            (7, "Cash, Online and discount vouchers"),
        ]),
        # 3 ------------------------------------------------------------------------------
        dict(kind="side", sec=1, title="Log in to the dashboard",
             notes="The login screen asks for an email address and a password. Walk through the three fields in order. Land the security message here, then repeat it on the next slide.",
             steps=[
                 ("Open the login page", "You will see “Login to your store”."),
                 ("Type your email address", "Use your own account email."),
                 ("Type your password", "Use your own password."),
                 ("Click Login", "You land on the dashboard."),
             ],
             rows=[[U("login", crop=(0.5, 0.22, 1.0, 0.80), cap="Login screen (form area)",
                      marks=[(1, 0.60, 0.335), (2, 0.60, 0.477), (3, 0.60, 0.60), (4, 0.60, 0.73)])]],
             banner=("must", "Never share your login credentials with anyone.")),
        # 4 ------------------------------------------------------------------------------
        dict(kind="statement", sec=1, headline="Never share your login.",
             sub="Your email and password are for you only.",
             chips=["Colleagues", "Managers", "Customers", "Anyone else"],
             notes="Pause on this slide. The rule is simple: login credentials are never shared with anyone, whoever asks and whatever the reason."),
        # 5 ------------------------------------------------------------------------------
        dict(kind="journey", sec=2, title="The agent journey at a glance",
             notes="This is the whole job in six steps. Each of the next sections zooms into one of them. Everything ends the same way: the order drops into the dashboard.",
             steps=[
                 ("Log in", "Sign in with your own email and password.", "SECTION 01"),
                 ("Select the customer", "Enter the phone number. New customer: register. Existing: continue.", "SECTION 03"),
                 ("Set the location", "Delivery: pin the location (the first of two times). Pick-up: choose the branch.", "SECTIONS 04 · 06"),
                 ("Build the order", "Search the menu, set sizes and extras, watch for sold-out items.", "SECTION 05"),
                 ("Check out", "Add the address (location, second time), apply the voucher, choose Cash or Online.", "SECTIONS 04 · 07"),
                 ("Order drops in", "Place Order - the order appears on the dashboard as a card.", "SECTION 02"),
             ],
             banner=("tip", "Follow the numbers. If you ever lose your place on a call, come back to this slide.")),
        # 6 ------------------------------------------------------------------------------
        dict(kind="wide", sec=2, title="Orders drop into the dashboard",
             notes="Each order arrives as a card. The header row summarises it: time, order ID, customer, delivery or pick-up, payment method and amount, requested time, and the status badge.",
             rows=[[U("orders_incoming", crop=(0, 0, 1, 0.64), cap="Order card as it lands (header row, items and customer)",
                      marks=[(1, 0.022, 0.064), (2, 0.955, 0.064), (3, 0.36, 0.30), (4, 0.74, 0.205)])]],
             steps=[
                 ("The order arrives", "Every order is its own card. The top row shows time, order ID, customer, order type, payment and amount, requested time."),
                 ("Read the status", "The badge at the top right shows where the order stands, for example Accepted."),
                 ("Items and price", "On the left: every item with its options, then subtotal, coupon, VAT and total."),
                 ("Customer and address", "On the right: name, phone, delivery address, note and a map."),
             ],
             banner=("tip", "Learn this layout - you will check every order you place against it.")),
        # 7 ------------------------------------------------------------------------------
        dict(kind="side", sec=2, title="What a fully recorded order looks like", left_w=3.6,
             notes="This is the target. When you finish an order, every block here should be filled in: items with their choices, the price breakdown, the customer, the address and map, and the status line.",
             steps=[
                 ("Items and choices", "Each item with its options and extras."),
                 ("Price breakdown", "Subtotal, coupon, VAT, service fees, total."),
                 ("Customer and phone", "Name, order ID, call / WhatsApp icons."),
                 ("Address and map", "Written address plus branch and customer pins."),
                 ("Status and log", "The Ready button and the “Order Accepted by …” line."),
             ],
             rows=[[U("order_full", cap="A fully recorded order",
                      marks=[(1, 0.36, 0.40), (2, 0.36, 0.80), (3, 0.80, 0.13), (4, 0.93, 0.42), (5, 0.96, 0.75)])]],
             banner=("tip", "Aim for this: when you place an order, every block should be complete.")),
        # 8 ------------------------------------------------------------------------------
        dict(kind="side", sec=2, title="Customer and address on the order", left_w=4.4,
             notes="Zoom into the customer panel. The map shows the branch pin and the customer pin together, so you can see how far the order has to travel.",
             steps=[
                 ("Name and order ID", "Who the order is for, and its reference."),
                 ("Primary contact", "The phone number, with copy and WhatsApp shortcuts."),
                 ("Address", "Full written address: building, floor, apartment."),
                 ("Branch pin", "The branch preparing the order (here: Sway Mall)."),
                 ("Customer pin", "Where the order is going."),
                 ("Cancel Order", "Sits top right - take care not to click it by mistake."),
             ],
             rows=[[U("order_customer_map", cap="Customer panel of an order",
                      marks=[(1, 0.60, 0.10), (2, 0.55, 0.225), (3, 0.97, 0.405), (4, 0.72, 0.57), (5, 0.47, 0.91), (6, 0.74, 0.07)])]]),
        # 9 ------------------------------------------------------------------------------
        dict(kind="side", sec=3, title="Step 1 · Enter the phone number", left_w=4.6, flow="v",
             notes="The phone number is how the system finds the customer. Type it slowly, then let the system answer: either the customer is recognised, or it says this looks like a new customer.",
             steps=[
                 ("Open Select Customer", "The window asks for the customer's Phone Number."),
                 ("Type the mobile number", "The field starts with +20 (Egypt). Type the rest and check every digit."),
                 ("Read the answer", "A registered customer is recognised. An unknown number shows “This looks like a new customer”."),
             ],
             rows=[[U("phone_entry", marks=[(1, 0.60, 0.12), (2, 0.70, 0.67)])],
                   [U("customer_new", cap="After typing an unregistered number", marks=[(3, 0.88, 0.68)])]],
             banner=("tip", "Read the number back to the customer before you move on.")),
        # 10 -----------------------------------------------------------------------------
        dict(kind="side", sec=3, title="New customer: register them", left_w=4.6, flow="h",
             notes="For a new number the system asks you to register the customer. Only the full name is needed here. The Save button stays grey until the name is valid.",
             steps=[
                 ("The system says it is a new customer", "“This looks like a new customer” - nothing is saved for this number yet."),
                 ("Click Add Customer", None),
                 ("Type the customer's Full Name", "Letters only. The form warns “Name should contain letters” and Save stays grey until it is valid."),
                 ("Click Save", "The customer is registered and you can carry on with the order."),
             ],
             rows=[[U("customer_new", marks=[(1, 0.88, 0.68), (2, 0.10, 0.83)]),
                    U("customer_details", marks=[(3, 0.75, 0.55)])],
                   [U("customer_save", cap="Save becomes active once the name is valid", marks=[(4, 0.07, 0.5)])]]),
        # 11 -----------------------------------------------------------------------------
        dict(kind="compare", sec=3, title="New vs existing customer",
             notes="The only difference is at the start. A new customer is registered first; an existing customer is simply recognised, and their saved addresses are ready at checkout.",
             panels=[
                 dict(label="New customer", color=ACCENT, row=[U("customer_new")], bullets=[
                     "The system says “This looks like a new customer”.",
                     "Click Add Customer, type the Full Name, click Save.",
                     "No saved addresses yet - you add the address at checkout (section 04).",
                 ]),
                 dict(label="Existing customer", color="3A3A3A", row=[
                     U("customer_existing", cap="Existing customer found"),
                     U("saved_addresses", crop=(0, 0.56, 1, 1), cap="Saved addresses at checkout")], bullets=[
                     "The number is recognised - no registration, carry straight on with the order.",
                     "Confirm the name shown with the customer on the line.",
                     "Their saved addresses are listed in Select Address: pick one, or add a new one.",
                 ]),
             ]),
        # 12 -----------------------------------------------------------------------------
        dict(kind="twice"),
        # 13 -----------------------------------------------------------------------------
        dict(kind="side", sec=4, title="Step 1 · Enter the initial location", left_w=4.6, flow="h",
             notes="This is the first of the two location entries. Pin the customer's location on the Order Mode map and save it. If the system says it does not deliver to the address, the pin is outside the delivery area.",
             steps=[
                 ("Choose Delivery", "In Order Mode, Delivery is the first tab."),
                 ("Search the location", "Type the address, or paste the coordinates, into Enter Location."),
                 ("Pick the suggestion", "The pin jumps to the match. The button reads Move The Pin until then."),
                 ("Click Save", "The location is now taken (first time)."),
             ],
             inset=[U("not_deliverable", cap="Outside the delivery area")],
             rows=[[U("map_search", cap="Search, then pick the suggestion",
                      marks=[(1, 0.10, 0.095), (2, 0.92, 0.18), (3, 0.92, 0.275)]),
                    U("map_save", cap="Pin placed: click Save", marks=[(4, 0.12, 0.95)])]]),
        # 14 -----------------------------------------------------------------------------
        dict(kind="side", sec=4, title="Step 2 · Pick a fake item", left_w=4.6, flow="h",
             notes="Checkout only opens once there is something in the basket. So pick any item as a stand-in, just to get to checkout, where the address is registered.",
             steps=[
                 ("Find any item", "Use Search (or browse the menu). It only has to be a stand-in."),
                 ("Open it and add it", "Click the item, then Add Item."),
                 ("Click Checkout", "The Checkout button appears in the bottom bar once the basket has an item."),
             ],
             inset=[U("checkout_bar", cap="Bottom bar once an item is in the basket")],
             rows=[[U("search_results", cap="Find any item", marks=[(1, 0.80, 0.04), (2, 0.88, 0.14)]),
                    U("basket_checkout", cap="Basket: click Checkout", marks=[(3, 0.62, 0.93)])]],
             banner=("tip", "The fake item is only there to open checkout - the address is registered from checkout.")),
        # 15 -----------------------------------------------------------------------------
        dict(kind="side", sec=4, title="Step 3 · Checkout: click Add new address", left_w=4.6, flow="h",
             notes="On checkout the Deliver to block says Please add an address in red. Click it to open Select Address, then click Add new address.",
             steps=[
                 ("Look at Deliver to", "It says “Please add an address” in red: no address is set on this order yet."),
                 ("Click the Deliver to block", "The Select Address window opens. Saved addresses, if any, are listed."),
                 ("Click Add new address", "This opens the location window for the second time."),
             ],
             rows=[[U("checkout_add_address", marks=[(1, 0.70, 0.86), (2, 0.93, 0.70)]),
                    U("saved_addresses", cap="Select Address", marks=[(3, 0.10, 0.70)])]]),
        # 16 -----------------------------------------------------------------------------
        dict(kind="side", sec=4, title="Step 4 · Enter the location again and register the address", left_w=4.7, flow="h",
             notes="This is the second location entry. Pin the location again, then complete the address form. Save the address and it is registered on the customer.",
             steps=[
                 ("Place the location again", "The map opens a second time. Search the same location and put the pin on it."),
                 ("Click Save", "The address form opens."),
                 ("Choose the type", "House, Apartment or Office."),
                 ("Check City and Area", "They are pre-filled - check they match the customer's location."),
                 ("Fill in the details", "Street, Building, Floor, Apartment Number. Notes and Save Address As are optional."),
                 ("Click Add new address", "The address is registered on the customer."),
             ],
             banner=("tip", "Pin in the wrong place? Tap “Edit Location” at the top of the form."),
             rows=[[U("map_second_location", cap="Location, second time",
                      marks=[(1, 0.72, 0.255), (2, 0.12, 0.935)]),
                    U("address_form", cap="Address form",
                      marks=[(3, 0.36, 0.255), (4, 0.88, 0.352), (5, 0.92, 0.55), (6, 0.10, 0.955)])]]),
        # 17 -----------------------------------------------------------------------------
        dict(kind="side", sec=5, title="Find items: search the menu", left_w=5.4,
             notes="Search is the fastest way to find an item. Every result has a detailed description underneath the name: use it to answer questions and confirm the item with the customer.",
             steps=[
                 ("Use the Search bar", "It sits at the top of the menu. You can also browse the categories under Menu."),
                 ("Type part of the name", "Results narrow as you type: “ice” lists every Iced drink."),
                 ("Read the description", "Under each name is a detailed description of the item."),
                 ("Check the price", "A range such as EGP 160 - 280 means the item comes in several sizes."),
                 ("Click the item", "It opens so you can choose size and options."),
             ],
             banner=("tip", "Every item has a detailed description underneath it. If the customer is unsure, read it out."),
             rows=[[U("search_results", cap="Search results for “ice”",
                      boxes=[(0.03, 0.195, 0.74, 0.228)],
                      marks=[(1, 0.80, 0.04), (2, 0.62, 0.13), (3, 0.55, 0.248), (4, 0.40, 0.168), (5, 0.88, 0.14)])]]),
        # 18 -----------------------------------------------------------------------------
        dict(kind="side", sec=5, title="Open an item and choose its options", left_w=5.0,
             notes="Open the item, pick the size, answer every Required group, set the quantity, then Add Item. The price on the button follows your choices.",
             steps=[
                 ("Open the item", "Photo, name and description are at the top."),
                 ("Choose the Size", "Each size has its own price (here Regular EGP 160, All Day EGP 280)."),
                 ("Answer the Required groups", "A group tagged Required, such as Your Choice of Coffee, must be answered."),
                 ("Set the quantity", "− and + at the bottom left."),
                 ("Click Add Item", "The button shows the price for your choices."),
             ],
             inset=[U("basket_items", cap="After Add Item: the item sits in Your Items with its choice")],
             rows=[[U("item_options", cap="Item window",
                      marks=[(1, 0.75, 0.47), (2, 0.60, 0.65), (3, 0.65, 0.795), (4, 0.12, 0.905), (5, 0.62, 0.95)])]]),
        # 19 -----------------------------------------------------------------------------
        dict(kind="compare", sec=5, title="Add or remove ingredients",
             notes="Extras and choices are options inside the item. Adding an extra adds its price; the choice then shows up on the recorded order. For removal, demonstrate on an item that has removable ingredients and drop that screenshot into the placeholder.",
             panels=[
                 dict(label="Add an ingredient / extra", color=ACCENT, row=[
                     U("order_item_options", crop=(0, 0.26, 1, 0.70), cap="How an extra is recorded: Extra - Caramel Sugar Free, EGP 45",
                       marks=[(1, 0.62, 0.40), (2, 0.50, 0.64)])], bullets=[
                     "Open the item and find the Extra group (or any option group).",
                     "Select the extra - its price is shown next to it (here EGP 45).",
                     "It is added to the item price and recorded on the order under Extra.",
                 ]),
                 dict(label="Remove an ingredient", color="3A3A3A", row=[
                     U("ingredient_remove", cap="Removing an ingredient")], bullets=[
                     "Open the item and look for the ingredient or a “no …” / “without …” option.",
                     "Deselect the ingredient (or choose the “no …” option) before Add Item.",
                     "Check Your Items shows the change before you move on.",
                 ]),
             ],
             banner=("tip", "Confirm every change back to the customer before you add the item.")),
        # 20 -----------------------------------------------------------------------------
        dict(kind="side", sec=5, title="Sold out or not available", left_w=5.0,
             notes="Unavailable items are visible in the menu but clearly marked: greyed out with a Sold out tag. Items that need scheduling carry a Schedule for tag instead. Always tell the customer immediately and offer an alternative.",
             steps=[
                 ("Available item", "Normal colours, with a + button on the photo."),
                 ("Sold out", "Name, price and photo are greyed out and a Sold out tag is shown. There is no + button."),
                 ("Scheduled only", "A tag such as “Schedule for Sep 28” means the item cannot be ordered ASAP - it is offered for that date."),
             ],
             banner=("warn", "Tell the customer straight away and offer an alternative from the same category."),
             inset=[U("sold_out_item", cap="The same Sold out tag on another item", marks=[(2, 0.30, 0.78)])],
             rows=[[U("sold_out_list", cap="A category with sold-out items",
                      marks=[(1, 0.55, 0.14), (2, 0.25, 0.385), (3, 0.42, 0.572), (2, 0.25, 0.73)])]]),
        # 21 -----------------------------------------------------------------------------
        dict(kind="side", sec=6, title="Pick-up: choose the branch", left_w=4.6, flow="h",
             notes="For pick-up, switch Order Mode to Pickup. The Select Branch list shows every branch nearest first, with its distance and address. Tap the arrow on the right branch.",
             steps=[
                 ("Choose Pickup", "In Order Mode, tap Pickup next to Delivery."),
                 ("Read the branch list", "Select Branch lists every branch, nearest first (“Sorted by distance”)."),
                 ("Click the arrow on the branch", "Each row shows the branch name, distance and address."),
                 ("Check the branch card", "The chosen branch shows as Pickup Branch with its map pin."),
             ],
             banner=("tip", "The full list of branches is on the next slide."),
             rows=[[U("pickup_branches", cap="Order Mode: Pickup",
                      marks=[(1, 0.60, 0.09), (2, 0.64, 0.14), (3, 0.82, 0.31)]),
                    U("pickup_branch_card", cap="Selected branch", marks=[(4, 0.65, 0.86)])]]),
        # 22 -----------------------------------------------------------------------------
        dict(kind="table", sec=6, title="Where are the branches?",
             notes="This is the list the system shows. Distances change with the customer's location, so read them off the screen rather than memorising them. The list scrolls: more branches may appear below Golf Central.",
             rows_data=[
                 ("Street Side Mall - El Shorouk", "El Shorouk – Street Side Mall"),
                 ("L4, The Strip Mall, Madinaty", "The Strip, Madinaty"),
                 ("The Drive 2", "The Drive 2"),
                 ("The Yard Mall Rehab", "The Yard Mall Gate 6 Rehab"),
                 ("The Mind Space", "Abdullah ibn Salamah, st, New Cairo 1, Cairo"),
                 ("Sway Mall", "Sway mall"),
                 ("Promenade Mall New Cairo", "Promenade Mall, Narges, 79 Street"),
                 ("District 5", "D5 Mall at District 5 Compound, Cairo Governorate"),
                 ("Golf Central - Palm Hills", "Palm Hills"),
             ],
             rows=[[U("pickup_branch_card", cap="Each branch also has a map pin")]],
             banner=("note", "The list scrolls - more branches may appear below Golf Central."),
             banner2=("tip", "Distances depend on the customer's location. Read them from the screen; do not rely on memory.")),
        # 23 -----------------------------------------------------------------------------
        dict(kind="side", sec=6, title="Pick-up date and time", left_w=4.6,
             notes="The pick-up time defaults to ASAP with an estimate (Ready in 15 minutes). For a later time, use Schedule slot and choose a date and time. Whatever is chosen is recorded on the order: show the pick-up order on the dashboard.",
             steps=[
                 ("Pickup is selected", "The toggle shows Pickup."),
                 ("Check the branch", "“Picking up from” names the branch. Use Change to switch."),
                 ("Read the default time", "“Ready in 15 minutes - ASAP” is the default."),
                 ("Need a later time? Schedule slot", "Choose the pick-up date and time."),
                 ("It is recorded on the order", "The branch and the requested date and time show on the order card."),
             ],
             rows=[[U("pickup_time", cap="Pick-up time block",
                      marks=[(1, 0.45, 0.14), (2, 0.60, 0.42), (3, 0.50, 0.72), (4, 0.68, 0.73)])],
                   [U("schedule_slot_picker", cap="Schedule slot"), U("pickup_order_recorded", cap="Pick-up order on the dashboard")]]),
        # 24 -----------------------------------------------------------------------------
        dict(kind="compare", sec=7, title="Payment options: Cash or Online",
             notes="Two options. Cash is selected by default. Online is the card option, shown on screen as Credit Card. After choosing, click Place Order.",
             panels=[
                 dict(label="Cash", color=ACCENT, row=[U("payment_place_order", cap="Pay with: Cash", boxes=[(0.0, 0.22, 1.0, 0.45)])], bullets=[
                     "Select Cash in the Pay with block.",
                     "The customer pays in cash.",
                     "The order record shows CASH and the amount in its header.",
                 ]),
                 dict(label="Online (Credit Card)", color="3A3A3A", row=[U("payment_place_order", cap="Pay with: Credit Card", boxes=[(0.0, 0.48, 1.0, 0.72)])], bullets=[
                     "Select Credit Card - this is the Online option.",
                     "The customer pays by card online.",
                     "Check the total with the customer before they pay.",
                 ]),
             ],
             banner=("tip", "Choose the payment method first, then click Place Order.")),
        # 25 -----------------------------------------------------------------------------
        dict(kind="side", sec=7, title="Add a discount voucher", left_w=4.6,
             notes="Vouchers go in the Save on this order box on checkout, between the delivery time and the Order Summary. Type the code, click Apply, and the discount appears in the summary and on the recorded order as Coupon Discount.",
             steps=[
                 ("Go to Checkout", "The page is shown in full on the right."),
                 ("Find “Save on this order”", "It sits between the Arrives-in time and the Order Summary."),
                 ("Type the code in Voucher", "Exactly as the customer gives it."),
                 ("Click Apply", "The discount shows in the Order Summary, and on the order as “Coupon Discount <CODE>”."),
             ],
             banner=("tip", "Apply the voucher before you click Place Order."),
             inset=[U("checkout_bar", cap="This bar shows how much more to add to unlock a discount")],
             rows=[[U("checkout_full", cap="Checkout page",
                      boxes=[(0.01, 0.52, 0.98, 0.665)],
                      marks=[(1, 0.93, 0.045), (2, 0.55, 0.552), (3, 0.45, 0.60), (4, 0.92, 0.552)])]]),
        # 26 -----------------------------------------------------------------------------
        dict(kind="side", sec=7, title="Review and place the order", left_w=4.6,
             notes="Read the Order Summary back to the customer. A delivery order adds a Delivery Services line; a pick-up order has none. Then Place Order, and the order drops into the dashboard (section 02).",
             steps=[
                 ("Read the Order Summary", "Subtotal, delivery fee (delivery only), service fee."),
                 ("Delivery vs pick-up", "A delivery order adds a Delivery Services line (EGP 30.00 here). A pick-up order has none."),
                 ("Check the Total", "Read it back to the customer."),
                 ("Click Place Order", "The order now drops into the dashboard - see section 02."),
             ],
             inset=[U("payment_place_order", cap="Place Order is the last step", marks=[(4, 0.10, 0.86)])],
             rows=[[U("summary_delivery", cap="Delivery order", marks=[(1, 0.62, 0.10), (2, 0.62, 0.52), (3, 0.62, 0.93)])],
                   [U("summary_pickup", cap="Pick-up order: no delivery line")]]),
        # 27 -----------------------------------------------------------------------------
        dict(kind="checklist", title="Before you place an order",
             notes="Close the session with this checklist. It is the whole deck on one page.",
             items=[
                 ("I logged in with my own account - and never share it.", "SECTION 01"),
                 ("Phone number entered; new customer registered, existing customer recognised.", "SECTION 03"),
                 ("Delivery or Pickup chosen.", "SECTIONS 04 · 06"),
                 ("Delivery: location taken twice - at the start, and under Add new address.", "SECTION 04"),
                 ("Items searched, descriptions read, sizes / extras / removals set.", "SECTION 05"),
                 ("No sold-out or unavailable item in the basket.", "SECTION 05"),
                 ("Pick-up: branch and date / time are right.", "SECTION 06"),
                 ("Payment chosen (Cash or Online) and voucher applied if there is one.", "SECTION 07"),
                 ("Order Summary checked, Place Order clicked, order shows on the dashboard.", "SECTIONS 02 · 07"),
             ]),
    ]


def k_twice(prs, ctx, page, spec):
    s = new_slide(prs, ctx, page, "This is the rule that catches people out: the location is entered two times. First on the Order Mode map, then again at checkout under Add new address, together with the address details. Walk the five steps along the bottom.")
    title_block(s, "The location is taken twice", 4)
    add_text(s, MX, 1.75, 8.5, 0.4, [P("Every delivery order needs the customer's location entered two times.", 15, color=MUTED)])
    pw, gap = (CONTENT_W - 0.4) / 2, 0.4
    cards = [
        ("1", "LOCATION · AT THE START", "Pin the customer's location on the Order Mode map and Save.",
         "It sets the delivery area, fee and time (for example El Shorouk – 5th District, EGP 30.00, 35–50 min)."),
        ("2", "LOCATION · AT CHECKOUT", "Click Add new address, pin the location again, then fill in the address details and save.",
         "This registers the customer's address."),
    ]
    for i, (n, label, main, sub) in enumerate(cards):
        x = MX + i * (pw + gap)
        add_rect(s, x, 2.35, pw, 2.35, fill=PANEL, line="333333", line_w=1, rounded=0.1)
        add_text(s, x + 0.3, 2.45, 1, 1, [P(n, 54, bold=True, color=ACCENT_TEXT)])
        add_text(s, x + 1.2, 2.62, pw - 1.5, 0.3, [P(label, 10, bold=True, color=ACCENT_TEXT)])
        add_text(s, x + 1.2, 2.95, pw - 1.5, 0.9, [P(main, 15, bold=True, spacing=1.05)])
        add_text(s, x + 1.2, 3.85, pw - 1.5, 0.8, [P(sub, 11.5, color=MUTED, spacing=1.05)])
    steps = ["Enter the initial location", "Pick a fake item", "Go to checkout", "Click Add new address", "Enter the location again and register the address"]
    n = len(steps)
    g = 0.18
    cw = (CONTENT_W - (n - 1) * g) / n
    for i, t in enumerate(steps):
        x = MX + i * (cw + g)
        last = i == n - 1
        add_rect(s, x, 5.0, cw, 1.15, fill=ACCENT if i in (0, n - 1) else PANEL, line=None if i in (0, n - 1) else "333333", line_w=1, rounded=0.08)
        add_text(s, x + 0.15, 5.1, 0.5, 0.4, [P(str(i + 1), 16, bold=True, color=FG if i in (0, n - 1) else ACCENT_TEXT)])
        add_text(s, x + 0.15, 5.5, cw - 0.3, 0.6, [P(t, 11, bold=True, spacing=1.0)])
        if not last:
            add_text(s, x + cw - 0.02, 5.35, g + 0.04, 0.4, [P("›", 16, bold=True, color=MUTED, align="c")], anchor="m", wrap=False)
    draw_banner(s, "must", "Take the location twice: once at the start, once under Add new address at checkout.", MX, 6.3, CONTENT_W, 11.5)
    return s


KINDS["twice"] = k_twice


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------
def build(ctx: Ctx, out_path: str) -> None:
    prs = Presentation()
    prs.slide_width = I(SLIDE_W)
    prs.slide_height = I(SLIDE_H)
    prs.core_properties.title = "Dashboard Training - step by step"
    prs.core_properties.subject = "Customer-service agent training: ordering dashboard"
    specs = deck_spec()
    for i, sp in enumerate(specs, 1):
        sec = sp.get("sec") or (4 if sp["kind"] == "twice" else None)
        if sec and sec not in ctx.section_first_page:
            ctx.section_first_page[sec] = i
    for i, sp in enumerate(specs, 1):
        KINDS[sp["kind"]](prs, ctx, i, sp)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    prs.save(out_path)


def list_slots() -> None:
    print(f"{'file name (any of .png/.jpg/.jpeg)':38} what it should show")
    for k, f, size, cap, show in SHOT_TABLE:
        print(f"{f:38} {show}")


def main(argv=None) -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--screenshots", default=os.path.join(here, "screenshots"), help="folder with the screenshot files")
    ap.add_argument("--out", default=os.path.join(here, "output", "Zyda_Dashboard_Training.pptx"), help="output .pptx")
    ap.add_argument("--header", default=RUNNING_HEADER, help="running header text (default: %(default)s; '' to hide)")
    ap.add_argument("--logo", default=None, help="optional logo image; otherwise the wordmark is drawn as vector shapes")
    ap.add_argument("--placeholders-only", action="store_true", help="ignore any screenshots and draw every slot as a placeholder")
    ap.add_argument("--list", action="store_true", help="list every screenshot slot and exit")
    args = ap.parse_args(argv)
    if args.list:
        list_slots()
        return 0
    ctx = Ctx(args.screenshots, args.placeholders_only, args.header, args.logo)
    build(ctx, args.out)
    print(f"Wrote {args.out}")
    print(f"  screenshots placed : {len(ctx.found)}")
    print(f"  placeholders drawn : {len(ctx.missing)}")
    for k in ctx.missing:
        print(f"    - {SHOTS[k]['file']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
