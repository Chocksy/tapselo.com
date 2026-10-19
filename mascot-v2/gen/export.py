# Per-cell resize of the built atlases to 208px tiles (2x the 104px render),
# webp q80, plus a contact sheet.
from PIL import Image, ImageDraw
import os
for s in ['directions','reactions']:
    im=Image.open(f'public/mascots/shopkeeper-{s}.webp').convert('RGBA'); W=im.size[0]//3
    T=208; out=Image.new('RGBA',(3*T,3*T),(0,0,0,0))
    for r in range(3):
        for c in range(3):
            out.paste(im.crop((c*W,r*W,(c+1)*W,(r+1)*W)).resize((T,T),Image.LANCZOS),(c*T,r*T))
    p=f'/workspace/hero-mascot-build/public/mascots/shopkeeper-{s}.webp'
    out.save(p,'WEBP',quality=75,method=6); print(p,os.path.getsize(p))
D=Image.open('/workspace/hero-mascot-build/public/mascots/shopkeeper-directions.webp'); R=Image.open('/workspace/hero-mascot-build/public/mascots/shopkeeper-reactions.webp')
cs=Image.new('RGBA',(1500,1600),(245,245,245,255)); d=ImageDraw.Draw(cs)
d.text((20,10),'Directions (page-mascot order: up-left, up, up-right / left, centre, right / down-left, down, down-right)',fill=(0,0,0))
cs.alpha_composite(D,(20,30))
d.text((760,10),'Reactions (blink, heart, sparkle / surprised, starstruck, bashful / sleepy, dizzy, delighted)',fill=(0,0,0))
cs.alpha_composite(R,(760,30))
d.text((20,782),'Same sheets on the site navy (#0f172a):',fill=(0,0,0))
dark=Image.new('RGBA',(1460,760),(15,23,42,255)); dark.alpha_composite(D,(0,20)); dark.alpha_composite(R,(740,20)); cs.alpha_composite(dark,(20,800))
cs.convert('RGB').save('/workspace/team/hero-mascot/v2/shopkeeper-contact-sheet.png')
