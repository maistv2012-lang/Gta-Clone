// Hysteresis prevents frequent render-target reallocations. Resolution changes
// affect only rendering, never simulation dt, input, collision or world positions.
export class AdaptiveResolution {
  constructor() { this.reset(1, false); }
  reset(max, enabled, fps=30) { this.max=max;this.min=Math.min(max,Math.max(.5,max*.65));this.ratio=max;this.enabled=enabled;this.fps=fps;this.average=1000/fps;this.samples=0;this.changedAt=0; }
  sample(ms, now) {
    if(!Number.isFinite(ms)||ms<=0||ms>3000)return false;
    this.average=this.average*.9+ms*.1;
    if(!this.enabled)return false;
    this.samples++;
    if(this.samples<12||now-this.changedAt<1800)return false;
    const budget=1000/this.fps;
    const next=this.average>budget*1.2?Math.max(this.min,this.ratio-.1):this.average<budget*.82?Math.min(this.max,this.ratio+.05):this.ratio;
    if(Math.abs(next-this.ratio)<.015)return false;
    this.ratio=next;this.changedAt=now;this.samples=0;return true;
  }
}
