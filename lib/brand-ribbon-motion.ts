export const RIBBON_DRAG_THRESHOLD = 6
export const RIBBON_MAX_SPEED = 1.5
const MOMENTUM_DECAY_MS = 325

export function wrapRibbonOffset(offset: number, width: number): number {
  if (width <= 0 || !Number.isFinite(offset)) return 0
  return -(((-offset % width) + width) % width)
}

export function isHorizontalRibbonDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) >= RIBBON_DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy)
}

export function ribbonReleaseSpeed(speed: number, idleMs: number, reducedMotion: boolean): number {
  if (reducedMotion || idleMs > 80 || !Number.isFinite(speed)) return 0
  return Math.max(-RIBBON_MAX_SPEED, Math.min(RIBBON_MAX_SPEED, speed))
}

// Integrate the decay exactly so 60 Hz and 120 Hz have the same motion.
export function advanceRibbonMotion(speed: number, elapsedMs: number, autoSpeed: number) {
  const elapsed = Math.max(0, Math.min(elapsedMs, 50))
  const decay = Math.exp(-elapsed / MOMENTUM_DECAY_MS)
  return {
    distance: autoSpeed * elapsed + (speed - autoSpeed) * MOMENTUM_DECAY_MS * (1 - decay),
    speed: autoSpeed + (speed - autoSpeed) * decay,
  }
}
