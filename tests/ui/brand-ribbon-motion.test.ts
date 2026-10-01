import { test } from "node:test"
import assert from "node:assert/strict"
import { advanceRibbonMotion, isHorizontalRibbonDrag, ribbonReleaseSpeed, wrapRibbonOffset } from "../../lib/brand-ribbon-motion"

test("ribbon wraps both directions and many complete cycles", () => {
  assert.equal(wrapRibbonOffset(-125, 100), -25)
  assert.equal(wrapRibbonOffset(125, 100), -75)
  assert.equal(wrapRibbonOffset(-10000025, 100), -25)
  assert.equal(Math.abs(wrapRibbonOffset(0, 100)), 0)
  assert.equal(wrapRibbonOffset(50, 0), 0)
})

test("click jitter and vertical page gestures do not start a drag", () => {
  assert.equal(isHorizontalRibbonDrag(5, 0), false)
  assert.equal(isHorizontalRibbonDrag(8, 20), false)
  assert.equal(isHorizontalRibbonDrag(-8, 2), true)
  assert.equal(isHorizontalRibbonDrag(8, 2), true)
})

test("release speed preserves direction, bounds fast input, and rejects a held or cancelled flick", () => {
  assert.equal(ribbonReleaseSpeed(0.7, 10, false), 0.7)
  assert.equal(ribbonReleaseSpeed(-0.7, 10, false), -0.7)
  assert.equal(ribbonReleaseSpeed(90, 10, false), 1.5)
  assert.equal(ribbonReleaseSpeed(-90, 10, false), -1.5)
  assert.equal(ribbonReleaseSpeed(0.7, 81, false), 0)
  assert.equal(ribbonReleaseSpeed(0.7, 10, true), 0)
  assert.equal(ribbonReleaseSpeed(NaN, 10, false), 0)
})

test("momentum has the same travel at different frame rates", () => {
  function travel(hz: number) {
    let speed = 1.2
    let distance = 0
    for (let i = 0; i < hz; i++) {
      const next = advanceRibbonMotion(speed, 1000 / hz, -0.1)
      speed = next.speed
      distance += next.distance
    }
    return { speed, distance }
  }
  const slow = travel(30)
  for (const hz of [60, 120, 144]) {
    const fast = travel(hz)
    assert.ok(Math.abs(fast.speed - slow.speed) < 1e-10)
    assert.ok(Math.abs(fast.distance - slow.distance) < 1e-8)
  }
})

test("automatic motion keeps its source speed and long frame gaps cannot make a large jump", () => {
  assert.equal(advanceRibbonMotion(-0.1, 20, -0.1).distance, -2)
  assert.equal(advanceRibbonMotion(-0.1, 20, -0.1).speed, -0.1)
  assert.deepEqual(advanceRibbonMotion(1, 5000, -0.1), advanceRibbonMotion(1, 50, -0.1))
})
