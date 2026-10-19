# v4: the generated sprite fades alpha to 0 over the bottom ~40px of every 360px cell
# (rows ~293-330). Colours stay valid there, so restore full opacity inside the
# silhouette down to a crisp horizontal bust line at CUT and drop everything below.
from PIL import Image
import os
src='/workspace/team/hero-mascot/v5/work/gen/public/mascots/'
FADE, CUT, T = 286, 318, 208
for s in ['directions','reactions']:
  im=Image.open(src+f'shopkeeper-{s}.webp').convert('RGBA');W=im.width//3
  out=Image.new('RGBA',(3*T,3*T),(0,0,0,0))
  for r in range(3):
    for c in range(3):
      cell=im.crop((c*W,r*W,(c+1)*W,(r+1)*W)); al=cell.getchannel('A'); a=al.load()
      for y in range(FADE,W):
        row=[a[x,y] for x in range(W)]; m=max(row) or 1
        for x in range(W):
          a[x,y]=0 if y>=CUT else (255 if row[x]>0.35*m else 0)
      cell.putalpha(al)
      out.paste(cell.resize((T,T),Image.LANCZOS),(c*T,r*T))
  p=f'/workspace/hero-mascot-build/public/mascots/shopkeeper-{s}.webp'
  out.save(p,'WEBP',quality=75,method=6); print(p,os.path.getsize(p))
