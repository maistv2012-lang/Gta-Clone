import * as THREE from 'three';
let cached;
// Original geometric ink and fabric atlas; no downloaded logos or character assets.
// One 512px texture and one material per quality, shared by all rugby rigs.
export function rugbyMaterials() {
  if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f2ede5'; g.fillRect(0,0,512,512);
  g.strokeStyle = '#3b3834'; g.lineWidth = 3;
  g.save(); g.beginPath(); g.rect(8,8,232,496); g.clip();
  for (let y=12;y<530;y+=56) for(let x=10;x<260;x+=58) {
    g.beginPath();g.moveTo(x,y-24);g.lineTo(x+24,y);g.lineTo(x,y+24);g.lineTo(x-24,y);g.closePath();g.stroke();
    g.beginPath();g.arc(x,y,15,0,Math.PI*1.7);g.stroke();
    g.beginPath();g.arc(x,y,7,0,Math.PI*1.5);g.stroke();
  }
  g.restore();
  // Woven cloth and restrained skin grain, deterministic and generated once.
  const pixels=g.getImageData(0,0,512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,grain=((x*17+y*31)%7)-3;
    for(let c=0;c<3;c++)pixels.data[i+c]=Math.max(0,pixels.data[i+c]+grain-(x>260&&(x+y)%3===0?9:0));
  }
  g.putImageData(pixels,0,0);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  cached={pbr:new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:.88}),
    low:new THREE.MeshLambertMaterial({map,vertexColors:true})};
  return cached;
}
