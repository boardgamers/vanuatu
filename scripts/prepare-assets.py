from PIL import Image, ImageDraw
from pathlib import Path
import json
root=Path('/home/eliheros/MEGA/boardgames/Vanuatu')
out=Path('viewer/assets');out.mkdir(exist_ok=True)
manifest={}
def save(name,path,size=(480,480),crop=None):
 im=Image.open(path).convert('RGBA')
 if crop:im=im.crop(crop)
 im.thumbnail(size,Image.Resampling.LANCZOS)
 im.save(out/(name+'.webp'),'WEBP',quality=87,method=6)
 manifest[name]=name+'.webp'
for n in [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39]:
 save(f'tile-{n}',root/'Island Tiles'/('Vanuatu Island Tiles CUT'+('' if n==1 else str(n))+'.png'))
for p in (root/'Characters').glob('*.jpg'):
 if p.stem!='x_backside':save('character-'+p.stem,p,(260,420))
for n in range(1,11):save('demand-'+str(n),root/'Demand'/f'Demand{n}.jpg',(400,230))
for n in range(1,5):save('rest-'+str(n),root/'rest_tokens'/f'REST{n}.jpg',(220,220))
board=root/'Game Board/Game_Board_Vanuatu_RGB.jpg'
save('efate',board,(480,480),(3030,2450,4280,3700))
ocean=root/'archipelagos/archipelago03.jpg'
w,h=Image.open(ocean).size
save('ocean',ocean,(480,480),(int(w*.3),int(h*.3),int(w*.7),int(h*.7)))
save('sand',root/'Demand/BACKSIDE_Demand.jpg',(500,280))
save('cover',root/'Game Box/Vanuatu_box_FRONT_NEW_small.jpg',(1100,1100))
for i,action in enumerate(['buy','explore','sail','build','rest','tourist','fish','sell','draw']):
 x=570+i*730
 save('action-'+action,board,(210,150),(x,110,min(x+680,7323),630))
Path('viewer/assets.js').write_text('\n'.join('import '+k.replace('-','_')+' from "./assets/'+v+'";' for k,v in manifest.items())+'\nexport const assets={'+','.join(json.dumps(k)+':'+k.replace('-','_') for k in manifest)+'};\n')
