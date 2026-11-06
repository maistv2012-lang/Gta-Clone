"""Original deterministic seamless PBR textures; no reference-image pixels used."""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import random, math
out=Path(__file__).resolve().parents[1]/'assets/christchurch';out.mkdir(parents=True,exist_ok=True)
N=512
for kind,base in [('limestone',(153,151,138)),('stone',(99,104,103)),('paving',(147,148,139)),('asphalt',(64,67,67)),('roof',(70,79,83)),('brick',(115,91,77))]:
 rng=random.Random(kind);color=Image.new('RGB',(N,N));height=Image.new('L',(N,N));c=color.load();h=height.load()
 for y in range(N):
  for x in range(N):
   mortar=False
   if kind in ['limestone','stone','brick']:
    row=y//32;xx=(x+(row%2)*64)%128;mortar=(y%32<2 or xx<2)
   elif kind=='paving':mortar=(x%128<3 or y%128<3)
   elif kind=='roof':mortar=(y%32<2 or (x+(y//32%2)*32)%64<2)
   noise=rng.gauss(0,6 if kind!='asphalt' else 12)
   broad=4*math.sin(2*math.pi*x/N*8)*math.sin(2*math.pi*y/N*4)
   v=-35 if mortar else noise+broad
   c[x,y]=tuple(max(0,min(255,int(a+v))) for a in base)
   h[x,y]=max(0,min(255,int((75 if mortar else 160)+noise*.7)))
 if kind=='asphalt':
  draw=ImageDraw.Draw(color)
  for i in range(3200):
   x,y=rng.randrange(N),rng.randrange(N);v=rng.randrange(70,115);draw.point((x,y),fill=(v,v,v))
 height=height.filter(ImageFilter.GaussianBlur(.65));px=height.load();normal=Image.new('RGB',(N,N));np=normal.load()
 for y in range(N):
  for x in range(N):
   dx=(px[(x-1)%N,y]-px[(x+1)%N,y])*.025;dy=(px[x,(y-1)%N]-px[x,(y+1)%N])*.025;l=math.sqrt(dx*dx+dy*dy+1)
   np[x,y]=(int(127.5+127.5*dx/l),int(127.5+127.5*dy/l),int(127.5+127.5/l))
 color.save(out/f'{kind}-color.jpg',quality=88,optimize=True)
 normal.save(out/f'{kind}-normal.png',optimize=True)
 rough=height.point(lambda v: min(255,220+(v-160)//8));rough.save(out/f'{kind}-roughness.png',optimize=True)
print('Generated 6 original PBR sets, 512×512; no external art dependencies')
# Original alpha-cutout leaf cluster for crossed-card, instanced tree crowns.
rng=random.Random('canterbury-foliage');foliage=Image.new('RGBA',(256,256),(0,0,0,0));draw=ImageDraw.Draw(foliage)
for branch in range(18):
 angle=rng.uniform(0,math.tau);length=rng.uniform(45,108);x=128+math.cos(angle)*length;y=140+math.sin(angle)*length
 draw.line([(128,230),(128,140),(x,y)],fill=(75,65,43,230),width=3)
for i in range(1500):
 x=rng.gauss(128,48);y=rng.gauss(118,46)
 if ((x-128)/112)**2+((y-118)/108)**2>1:continue
 size=rng.randrange(3,9);shade=rng.randrange(-18,23)
 draw.ellipse((x-size,y-size*.45,x+size,y+size*.45),fill=(max(0,72+shade),max(0,93+shade),max(0,47+shade//2),255))
foliage.save(out/'foliage-color.png',optimize=True)
