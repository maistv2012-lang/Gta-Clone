export const QUALITY = Object.freeze({
  low: Object.freeze({
    name: 'low',
    pixelRatio: 0.8,
    shadowSize: 0,
    near: 35,
    far: 120,
    post: false,
    trees: 0.5,
  }),
  medium: Object.freeze({
    name: 'medium',
    pixelRatio: 1,
    shadowSize: 1024,
    near: 85,
    far: 220,
    post: false,
    trees: 0.8,
  }),
  high: Object.freeze({
    name: 'high',
    pixelRatio: 1.5,
    shadowSize: 2048,
    near: 160,
    far: 360,
    post: true,
    trees: 1,
  }),
});
export function qualityProfile(settings, touch = false) {
  return settings.lowGfx
    ? QUALITY.low
    : QUALITY[settings.quality] || QUALITY[touch ? 'medium' : 'high'];
}
export function targetFrameRate(settings, touch = false) {
  return Number(settings.fps) === 60 ? 60 : Number(settings.fps) === 30 ? 30 : touch ? 30 : 60;
}
