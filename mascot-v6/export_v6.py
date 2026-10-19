# v6: per-cell resize of the skill atlases to 208px tiles, webp q75, keeping the original soft bottom fade.
from PIL import Image
import os
for s in ['directions','reactions']:
    im=Image.open(f'public/mascots/shopkeeper-{s}.webp').convert('RGBA'); W=im.size[0]//3; T=208
    out=Image.new('RGBA',(3*T,3*T),(0,0,0,0))
    for r in range(3):
        for c in range(3): out.paste(im.crop((c*W,r*W,(c+1)*W,(r+1)*W)).resize((T,T),Image.LANCZOS),(c*T,r*T))
    p=f'/workspace/hero-mascot-build/public/mascots/shopkeeper-{s}.webp'; out.save(p,'WEBP',quality=75,method=6); print(p,os.path.getsize(p))
