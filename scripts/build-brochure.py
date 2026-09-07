"""Build the public Gayatri Convention brochure PDF from current property details."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
IMG = PUBLIC / "site" / "images"
FONTS = Path(r"C:\Windows\Fonts")

W, H = 1190, 1684
M = 72
GOLD = (198, 164, 82)
GOLD_SOFT = (212, 186, 120)
INK = (42, 39, 36)
MUTED = (92, 84, 74)
CREAM = (243, 234, 216)
CREAM_CARD = (252, 247, 236)
BLACK = (11, 9, 7)
LINE = (214, 198, 168)


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def inr(n):
    s = str(int(n))
    if len(s) <= 3:
        return "₹" + s
    last, rest = s[-3:], s[:-3]
    groups = []
    while rest:
        groups.append(rest[-2:])
        rest = rest[:-2]
    return "₹" + ",".join(list(reversed(groups)) + [last])


def cover_fit(path, box):
    im = Image.open(path).convert("RGB")
    bw, bh = box
    scale = max(bw / im.width, bh / im.height)
    im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.Resampling.LANCZOS)
    left = (im.width - bw) // 2
    top = (im.height - bh) // 2
    return im.crop((left, top, left + bw, top + bh))


def paste_rgba(base, path, box, height):
    mark = Image.open(path).convert("RGBA")
    ratio = height / mark.height
    mark = mark.resize((int(mark.width * ratio), height), Image.Resampling.LANCZOS)
    x = box[0] + (box[2] - box[0] - mark.width) // 2
    y = box[1]
    base.paste(mark, (x, y), mark)
    return mark.height


def wrap(draw, text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def center(draw, text, y, fnt, fill, width=W):
    tw = draw.textlength(text, font=fnt)
    draw.text(((width - tw) / 2, y), text, font=fnt, fill=fill)


def hline(draw, y, x0=M, x1=W - M, fill=GOLD, width=1):
    draw.line([(x0, y), (x1, y)], fill=fill, width=width)


def page1():
    im = Image.new("RGB", (W, H), BLACK)
    d = ImageDraw.Draw(im)
    d.rectangle([36, 36, W - 37, H - 37], outline=GOLD, width=1)
    d.rectangle([44, 44, W - 45, H - 45], outline=(70, 58, 32), width=1)

    title = font("georgiab.ttf", 92)
    italic = font("georgiai.ttf", 28)
    small = font("calibri.ttf", 20)
    offers = font("georgiab.ttf", 22)

    paste_rgba(im, IMG / "logo-gold.png", (M, 160, W - M, H), 600)
    center(d, "GAYATRI", 820, title, GOLD)
    center(d, "Palagummi · Konaseema", 930, italic, GOLD_SOFT)
    hline(d, 1000, 360, W - 360, GOLD, 1)
    for i, line in enumerate(["Convention", "Luxury banquets", "Resorts"]):
        center(d, line, 1040 + i * 40, offers, GOLD)
    addr = [
        "Palagummi Village, Razole Mandal",
        "Dr. B.R.A. Konaseema",
        "Andhra Pradesh 533249",
    ]
    for i, line in enumerate(addr):
        center(d, line.upper(), 1388 + i * 30, small, GOLD_SOFT)
    center(d, "+91 98496 00555  ·  events@gayatrifunctionhall.com", 1490, small, GOLD)
    return im


def page2():
    im = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(im)
    d.rectangle([36, 36, W - 37, H - 37], outline=LINE, width=1)

    crumb = font("calibri.ttf", 16)
    heading = font("georgiab.ttf", 42)
    sub = font("georgiai.ttf", 20)
    name_f = font("georgiab.ttf", 20)
    body = font("calibri.ttf", 15)
    cap_f = font("calibri.ttf", 14)
    price_f = font("georgiab.ttf", 16)
    note = font("calibri.ttf", 14)

    d.text((M, 70), "VENUES", font=crumb, fill=GOLD)
    d.text((M, 96), "Convention venues", font=heading, fill=INK)
    d.text((M, 154), "Half day and full day hire. GST extra at 18%.", font=sub, fill=MUTED)

    halls = [
        {
            "photo": IMG / "venue-imperial.jpg",
            "jp": "Plenary sessions",
            "name": "Imperial Ballroom",
            "copy": "A double-height hall for conferences and exhibitions, with crystal light and a full stage.",
            "cap": "1,000–3,000",
            "half": 300000,
            "full": 450000,
        },
        {
            "photo": IMG / "venue-garden.jpg",
            "jp": "Outdoor conference",
            "name": "Garden Pavilion",
            "copy": "Lawn, fountain court, and a covered pavilion — made for outdoor conferences and exhibitions.",
            "cap": "800",
            "half": 125000,
            "full": 250000,
        },
        {
            "photo": IMG / "venue-courtyard.jpg",
            "jp": "Board meetings",
            "name": "Heritage Courtyard (MINI)",
            "copy": "A quieter hall for board meetings and training, with a private inner court.",
            "cap": "100–500",
            "half": 125000,
            "full": 200000,
        },
    ]

    gap = 22
    col_w = (W - 2 * M - 2 * gap) // 3
    photo_h = 220
    y0 = 210
    for i, hall in enumerate(halls):
        x = M + i * (col_w + gap)
        photo = cover_fit(hall["photo"], (col_w, photo_h))
        im.paste(photo, (x, y0))
        d.rectangle([x, y0 + photo_h, x + col_w, y0 + photo_h + 4], fill=GOLD)
        y = y0 + photo_h + 22
        d.text((x, y), hall["jp"].upper(), font=cap_f, fill=GOLD)
        y += 26
        for line in wrap(d, hall["name"], name_f, col_w):
            d.text((x, y), line, font=name_f, fill=INK)
            y += 26
        y += 6
        for line in wrap(d, hall["copy"], body, col_w):
            d.text((x, y), line, font=body, fill=MUTED)
            y += 20
        y += 10
        d.text((x, y), f"Capacity  |  {hall['cap']}", font=cap_f, fill=INK)
        y += 28
        card = [x, y, x + col_w, y + 78]
        d.rounded_rectangle(card, radius=4, fill=CREAM_CARD, outline=GOLD, width=1)
        d.text((x + 14, y + 12), "Half day", font=cap_f, fill=MUTED)
        d.text((x + 14, y + 42), "Full day", font=cap_f, fill=MUTED)
        hw = d.textlength(inr(hall["half"]), font=price_f)
        fw = d.textlength(inr(hall["full"]), font=price_f)
        d.text((x + col_w - 14 - hw, y + 10), inr(hall["half"]), font=price_f, fill=INK)
        d.text((x + col_w - 14 - fw, y + 40), inr(hall["full"]), font=price_f, fill=INK)

    y = 1040
    hline(d, y, fill=LINE)
    y += 28
    d.text((M, y), "Programmes we host", font=name_f, fill=INK)
    y += 36
    events = [
        "Conference",
        "Seminar",
        "Corporate meeting",
        "Exhibition",
        "Training / Workshop",
        "Product launch",
        "Annual day / AGM",
        "Marriage",
        "Reception",
        "Family retreat",
    ]
    chip = font("calibri.ttf", 14)
    x = M
    row_y = y
    for ev in events:
        tw = d.textlength(ev, font=chip) + 28
        if x + tw > W - M:
            x = M
            row_y += 40
        d.rounded_rectangle([x, row_y, x + tw, row_y + 28], radius=12, outline=GOLD, width=1)
        d.text((x + 14, row_y + 5), ev, font=chip, fill=INK)
        x += tw + 10

    y = 1320
    d.rounded_rectangle([M, y, W - M, y + 220], radius=6, fill=CREAM_CARD, outline=LINE, width=1)
    d.text((M + 28, y + 24), "Venue hire and guest rooms", font=name_f, fill=INK)
    notes = [
        "Gayatri Convention hires venues and guest rooms only. Catering, decoration, DJ, AV beyond the venue fit-out, and photography are arranged by you.",
        "Rates above are venue hire for half day and full day. GST is extra at 18%. A booking is confirmed after the agreed advance is received.",
        "Desk 10:00 – 20:00. Tours by appointment.",
    ]
    ty = y + 64
    for para in notes:
        for line in wrap(d, para, note, W - 2 * M - 56):
            d.text((M + 28, ty), line, font=note, fill=MUTED)
            ty += 20
        ty += 8
    return im


def page3():
    im = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(im)
    d.rectangle([36, 36, W - 37, H - 37], outline=LINE, width=1)

    crumb = font("calibri.ttf", 16)
    heading = font("georgiab.ttf", 38)
    sub = font("georgiai.ttf", 20)
    name_f = font("georgiab.ttf", 20)
    body = font("calibri.ttf", 15)
    small = font("calibri.ttf", 14)
    price_f = font("georgiab.ttf", 22)
    table = font("calibri.ttf", 15)
    table_b = font("calibrib.ttf", 15)

    d.text((M, 64), "STAY", font=crumb, fill=GOLD)
    d.text((M, 90), "The Royal Family Retreat", font=heading, fill=INK)
    d.text((M, 144), "One stay. One family. A thousand beautiful memories.", font=sub, fill=MUTED)

    photo_w = (W - 2 * M - 18) // 2
    photo_h = 210
    im.paste(cover_fit(IMG / "retreat-family-lobby.jpg", (photo_w, photo_h)), (M, 190))
    im.paste(cover_fit(IMG / "retreat-family-dining.jpg", (photo_w, photo_h)), (M + photo_w + 18, 190))

    y = 424
    d.rounded_rectangle([M, y, W - M, y + 92], radius=6, fill=(28, 62, 62), outline=GOLD, width=1)
    d.text((M + 28, y + 18), "4 Rooms + Kitchen + Dining Hall + Lobby", font=name_f, fill=GOLD_SOFT)
    d.text((M + 28, y + 50), "Exclusive family stay  ·  up to 8 guests  ·  4 Deluxe AC", font=small, fill=CREAM)
    pw = d.textlength(inr(30000) + " / package", font=price_f)
    d.text((W - M - 28 - pw, y + 30), inr(30000) + " / package", font=price_f, fill=GOLD)

    y = 540
    for line in wrap(
        d,
        "Your family shares one space: four rooms, a private kitchen, a dining hall and a lobby. No rushing between separate rooms, and no searching for restaurants for every meal.",
        body,
        W - 2 * M,
    ):
        d.text((M, y), line, font=body, fill=MUTED)
        y += 20

    y += 28
    d.text((M, y), "Guest rooms", font=name_f, fill=INK)
    y += 36
    headers = ["Type", "Rooms", "Base rate", "Extra bed", "Max guests"]
    rows = [
        ["Suite AC", "101–102", inr(5500), inr(800), "4"],
        ["Deluxe AC", "201–212", inr(3500), inr(600), "4"],
        ["Standard AC", "301–308", inr(2500), inr(600), "4"],
        ["Royal Family Retreat", "4 Deluxe AC", inr(30000), "—", "8"],
    ]
    cols = [260, 180, 180, 180, 140]
    x0 = M
    d.rectangle([M, y, W - M, y + 36], fill=(28, 62, 62))
    cx = x0 + 16
    for htxt, cw in zip(headers, cols):
        d.text((cx, y + 9), htxt, font=small, fill=GOLD_SOFT)
        cx += cw
    y += 36
    for r, row in enumerate(rows):
        bg = CREAM_CARD if r % 2 == 0 else (236, 226, 208)
        d.rectangle([M, y, W - M, y + 34], fill=bg)
        cx = x0 + 16
        for i, (cell, cw) in enumerate(zip(row, cols)):
            d.text((cx, y + 8), cell, font=table_b if i == 0 else table, fill=INK)
            cx += cw
        y += 34

    y += 18
    d.text((M, y), "22 guest rooms in all. Room rent is per night. GST extra at 18%.", font=small, fill=MUTED)

    y += 48
    d.text((M, y), "Visit & book", font=name_f, fill=INK)
    y += 34
    visit = [
        "Gayatri Convention",
        "Palagummi Village, Razole Mandal, Dr. B.R.A. Konaseema, Andhra Pradesh 533249",
        "Map listing: GAYATRI WATER AND BEVERAGES, Palagummi Village, Razole Mandal",
        "Desk 10:00 – 20:00  ·  Tours by appointment",
        "+91 98496 00555  ·  events@gayatrifunctionhall.com",
    ]
    for line in visit:
        d.text((M, y), line, font=body if line != visit[0] else name_f, fill=INK if line == visit[0] else MUTED)
        y += 24 if line != visit[0] else 28

    y += 16
    hline(d, y, fill=LINE)
    y += 18
    d.text((M, y), "Gayatri Convention  ·  Palagummi · Konaseema", font=small, fill=MUTED)
    tw = d.textlength("+91 98496 00555", font=small)
    d.text((W - M - tw, y), "+91 98496 00555", font=small, fill=GOLD)
    return im


def main():
    pages = [page1(), page2(), page3()]
    pdf = PUBLIC / "Gayatri-Brochure.pdf"
    pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=144)
    pages[0].save(PUBLIC / "brochure-1.png")
    pages[1].save(PUBLIC / "brochure-2.png")
    pages[2].save(PUBLIC / "brochure-3.png")
    print("wrote", pdf)
    for p in pages:
        print("page", p.size)


if __name__ == "__main__":
    main()
