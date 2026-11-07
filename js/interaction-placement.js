// Deterministic, bounded placement for a small interactive prop. The caller
// supplies the existing collision query; neither geography nor colliders change.
export function clearInteractionPoint(preferred, anchor, blocked, minimumDistance = 6.5) {
  const valid = point => Math.hypot(point.x-anchor.x,point.z-anchor.z)>=minimumDistance&&!blocked(point);
  if(valid(preferred))return {...preferred};
  const away=Math.atan2(preferred.z-anchor.z,preferred.x-anchor.x);
  for(let radius=1;radius<=32;radius++)for(let step=0;step<32;step++){
    const turn=step===0?0:Math.ceil(step/2)*(step%2?1:-1)*Math.PI/16;
    const point={x:preferred.x+Math.cos(away+turn)*radius,y:preferred.y??0,z:preferred.z+Math.sin(away+turn)*radius};
    if(valid(point))return point;
  }
  throw new Error('No accessible casino vault position near the original hatch');
}
