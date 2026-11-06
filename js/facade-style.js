// Stable per-OSM-building variation; no random work per frame or topology edits.
export function facadeStyle(area) {
  let seed=2166136261;for(const c of String(area.id))seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const tags=area.tags||{},modern=/Tūranga|Novotel|Spark|Te Pae/.test(tags.name||'')||tags['building:material']==='glass';
  return {modern,bayWidth:modern?3.3:4.1+(seed%4)*.3,windowWidth:modern?2.6:1.45+(seed%3)*.2,
    finish:tags['building:material']==='brick'?'brick':modern?'limestone':['stone','limestone','brick'][seed%3],
    recessed:!modern&&seed%2===0,pilasters:!modern&&seed%3===0};
}
