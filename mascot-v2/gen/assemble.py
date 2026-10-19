# Normalise the per-frame drawings onto the template's body and build the two 3x3 source
# sheets in page-mascot's cell order. Output: characters/shopkeeper/{directions,reactions}.png
import numpy as np, os
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter
F = 'frames'; S = 1024
tpl = Image.open(f'{F}/template1.png').convert('RGBA')

def band(im, up=40):
    a = np.array(im)[..., 3] > 128; ys, xs = np.where(a); y0 = ys.max() - up
    row = np.where(a[y0])[0]; return ys.max(), row.min(), row.max()

T_bot, T_l, T_r = band(tpl)
T_w = T_r - T_l; T_cx = (T_l + T_r) / 2

def normalise(im):
    bot, l, r = band(im); s = T_w / (r - l)
    im2 = im.resize((round(S * s), round(S * s)), Image.LANCZOS)
    cx = (l + r) / 2 * s; by = bot * s
    out = Image.new('RGBA', (S, S)); out.alpha_composite(im2, (0, 0)) if False else None
    out.paste(im2, (round(T_cx - cx), round(T_bot - by)), im2)
    return out

# The cut between the frame's head and the template's body: the collar line.
CUT = int(os.environ.get('CUT', 0)) or None
CUT0 = int(T_bot - (T_bot - 126) * 0.36)
def on_body(head, cut, feather=18):
    """Template body below `cut`, frame above it, feathered so the seam disappears."""
    body = np.array(tpl).astype(np.float32)
    body[:cut, :, 3] = 0           # template body only: never let its head show through
    out = Image.fromarray(body.astype(np.uint8), 'RGBA')
    a = np.array(head).astype(np.float32)
    ramp = np.ones(S, np.float32); ramp[cut:cut + feather] = np.linspace(1, 0, feather); ramp[cut + feather:] = 0
    a[..., 3] *= ramp[:, None]
    out.alpha_composite(Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA'))
    return out

def head_w(im, cut):
    from scipy import ndimage
    a = np.array(im)[..., 3] > 128
    lab, n = ndimage.label(a)
    if n > 1:  # ignore floating hearts / sparkles / zzz
        a = lab == (np.argmax(ndimage.sum(a, lab, range(1, n + 1))) + 1)
    xs = np.where(a[:cut].any(axis=0))[0]; return xs.max() - xs.min()

def match_head(im, cut):
    """Rescale about the shoulder anchor so the head is the template's head width."""
    s = head_w(tpl, cut) / head_w(im, cut)
    s = max(0.8, min(1.1, s))
    big = im.resize((round(S * s), round(S * s)), Image.LANCZOS)
    out = Image.new('RGBA', (S, S))
    out.paste(big, (round(T_cx - T_cx * s), round(T_bot - T_bot * s)), big)
    return out

def load(n, mirror=False):
    im = Image.open(f'{F}/{n}.png').convert('RGBA')
    im = match_head(normalise(im), CUT0)
    if mirror:
        im = ImageOps.mirror(im)
        # re-centre on the template after the flip
        bot, l, r = band(im); dx = round(T_cx - (l + r) / 2)
        im = im.transform(im.size, Image.AFFINE, (1, 0, -dx, 0, 1, 0))
    return im

def zzz(im):
    d = ImageDraw.Draw(im)
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 54)
    except OSError: f = ImageFont.load_default()
    a = np.array(im)[..., 3] > 128; ys, xs = np.where(a); top = ys.min()
    x0 = int(xs.max() - 120)
    for i, (dx, dy, sz) in enumerate([(0, 0, 40), (42, -38, 50), (92, -82, 60)]):
        fi = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', sz)
        d.text((x0 + dx, top - 30 + dy), 'z', font=fi, fill=(70, 140, 235, 255), stroke_width=4, stroke_fill=(20, 20, 30, 255))
    return im

cut = CUT or int(T_bot - (T_bot - 126) * 0.36)   # just under the chin, on the collar
directions = [
    load('d0_up-left'), load('d1_up'), load('d0_up-left', mirror=True),
    load('d3_left'), tpl.copy(), load('d3_left', mirror=True),
    load('d8_down-right'), load('d7_down'), load('d8_down-right', mirror=True),  # d8 art faces left
]
reactions = [load(n) for n in ['r0_blink', 'r1_heart', 'r2_sparkle', 'r3_surprised', 'r4_wink', 'r5_bashful']]
reactions += [zzz(load('r0_blink')), load('r7_dizzy'), load('r8_delighted')]
directions = [h if i == 4 else on_body(h, cut + (40 if i >= 6 else 0)) for i, h in enumerate(directions)]  # down row: chins reach lower
reactions = [on_body(h, cut) for h in reactions]
os.makedirs('characters/shopkeeper', exist_ok=True)
for name, cells in [('directions', directions), ('reactions', reactions)]:
    sheet = Image.new('RGBA', (3 * S, 3 * S))
    for i, c in enumerate(cells): sheet.paste(c, ((i % 3) * S, (i // 3) * S), c)
    sheet.save(f'characters/shopkeeper/{name}.png')
print('cut', cut, 'tpl band', T_bot, T_l, T_r)
