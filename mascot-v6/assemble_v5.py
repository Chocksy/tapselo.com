# v5: fix the "double neck/collar". v2 kept each frame's own neck/collar above the seam
# (feathered onto the template body), so raised chins showed a second collar.
# Now: keep only each frame's HEAD (face enclosed by its outline + hair/ears), drop its
# neck/collar, align its chin onto the template's chin, and put it on ONE shared torso
# (the centre frame's neck + collar + apron).
import numpy as np, os, sys
from PIL import Image, ImageFilter
from scipy import ndimage
sys.argv=[sys.argv[0]]
src=open('assemble.py').read().split("cut = CUT or")[0]
exec(src)   # template, normalise, load, zzz, ...

def head_mask(im):
    a=np.array(im).astype(np.int32); al=a[...,3]>128
    luma=(a[...,0]*299+a[...,1]*587+a[...,2]*114)//1000
    dark=al&(luma<95)
    seal=ndimage.binary_dilation(dark,iterations=3)
    lab,n=ndimage.label(al&~seal)
    # face = largest skin-coloured component in the upper 2/3 of the figure
    ys,xs=np.where(al); top,bot=ys.min(),ys.max()
    skin=al&(a[...,0]>200)&(a[...,1]>120)&(a[...,1]<200)&(a[...,2]<160)
    best,bs=0,0
    for i in range(1,n+1):
        m=lab==i; s=(m&skin).sum(); yy=np.where(m)[0].mean()
        if s>bs and yy<top+(bot-top)*0.6: best,bs=i,s
    face=lab==best
    fy=np.where(face)
    chin=fy[0].max()
    fcy=int(fy[0].mean())
    head=ndimage.binary_dilation(face,iterations=int(os.environ.get('DIL',11)))            # + its outline
    upper=np.zeros_like(al); upper[:fcy]=True
    rgbmax=a[...,:3].max(-1); rgbmin=a[...,:3].min(-1)
    pale=(rgbmin>170)&(rgbmax-rgbmin<70)                        # white/cream: shirt, collar, halo
    keep=al&~pale
    head|=keep&upper                                            # hair, top of ears
    # ears/side hair down to the chin line, but only outside the face's column span near the chin
    side=np.zeros_like(al); side[fcy:chin-40]=True
    head|=keep&side  # ears
    head&=al
    head=ndimage.binary_fill_holes(head)
    # drop detached specks (hair wisps on the shoulders, collar bits); keep the head blob
    # and the floating reaction glyphs (hearts/sparkles) above the face
    lab2,n2=ndimage.label(head)
    if n2>1:
        sizes=ndimage.sum(head,lab2,range(1,n2+1)); big=np.argmax(sizes)+1
        for i in range(1,n2+1):
            if i==big: continue
            yy=np.where(lab2==i)[0]
            if yy.max()>fcy: head[lab2==i]=False
    return head, chin+11

def soft(m,r=1.5):
    return np.array(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)))/255.0

tm,tchin=head_mask(tpl)
torso=np.array(tpl).astype(np.float32); torso[...,3]*=(1-soft(tm))   # template minus its head
# the template's own white sticker halo / collar wings beside its jaw would show once a
# different head sits there: above the chin keep only the neck column.
ta=np.array(tpl).astype(np.int32)
skin_row=(ta[tchin+12,:,3]>128)&(ta[tchin+12,:,0]>200)&(ta[tchin+12,:,2]<170)
nx=np.where(skin_row)[0]; NL,NR=nx.min()-4,nx.max()+4
print('neck cols',NL,NR)
torso[:tchin-70]=0
bnd=torso[tchin-70:tchin+8]; bnd[:,:NL]=0; bnd[:,NR:]=0
# and the template's pale sticker halo between its jaw and ears, above the chin
tb=ta[tchin-70:tchin-4]; pal=(tb[...,:3].min(-1)>170)&((tb[...,:3].max(-1)-tb[...,:3].min(-1))<70)
torso[tchin-70:tchin-4][pal]=0
torso=Image.fromarray(torso.clip(0,255).astype(np.uint8),'RGBA')

def on_torso(fr, extra=0):
    m,chin=head_mask(fr)
    dy=tchin-chin+extra
    dy=max(-40,min(60,dy))
    a=np.array(fr).astype(np.float32); a[...,3]*=soft(m)
    head=Image.fromarray(a.clip(0,255).astype(np.uint8),'RGBA')
    out=torso.copy(); out.alpha_composite(head,(0,dy))
    return out, chin, dy

D=[('d0_up-left',0),('d1_up',0),('d0_up-left',1),('d3_left',0),(None,0),('d3_left',1),('d8_down-right',0),('d7_down',0),('d8_down-right',1)]
dirs=[]; info=[]
for n,mir in D:
    if n is None: dirs.append(tpl.copy()); info.append(('centre',tchin,0)); continue
    o,c,dy=on_torso(load(n,mirror=bool(mir)),extra=int(os.environ.get('EXTRA',0)) if n in ('d3_left','d0_up-left','d8_down-right') else 0); dirs.append(o); info.append((n+('-mirror' if mir else ''),c,dy))
R=['r0_blink','r1_heart','r2_sparkle','r3_surprised','r4_wink','r5_bashful',None,'r7_dizzy','r8_delighted']
reas=[]
for n in R:
    fr=load(n or 'r0_blink'); o,c,dy=on_torso(fr)
    if n is None: o=zzz(o)
    reas.append(o); info.append((n or 'sleepy',c,dy))
print('template chin',tchin); [print(i) for i in info]
os.makedirs('characters/shopkeeper',exist_ok=True)
for name,cells in [('directions',dirs),('reactions',reas)]:
    sheet=Image.new('RGBA',(3*S,3*S))
    for i,c in enumerate(cells): sheet.paste(c,((i%3)*S,(i//3)*S),c)
    sheet.save(f'characters/shopkeeper/{name}.png')
