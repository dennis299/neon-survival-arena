// Short vibration pulses for hurt/level-up/boss feedback on devices that
// support the Vibration API. Respects the player's haptics setting and
// silently no-ops everywhere else (desktop, iOS Safari, headless tests).

let enabled = true

export function setHapticsEnabled(v: boolean) {
  enabled = v
}

function vibrate(pattern: number | number[]) {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported — fine
  }
}

export const haptics = {
  hurt: () => vibrate(30),
  dash: () => vibrate(12),
  levelUp: () => vibrate([15, 40, 15]),
  evolution: () => vibrate([25, 40, 25, 40, 90]),
  bossWarn: () => vibrate([60, 80, 60, 80, 60]),
  bossDie: () => vibrate([40, 60, 40, 60, 120]),
}
