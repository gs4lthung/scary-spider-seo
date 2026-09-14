function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

function easeInOutCubic(p: number) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * A recurring "attack" envelope in [0, 1]: a sharp lunge up (ease-out), a
 * brief hold at full extension, then a slower settle back to rest — followed
 * by an idle pause before it repeats. Every caller passes the same
 * `clock.elapsedTime`, so body and legs stay perfectly in sync without any
 * shared state.
 */
export function attackPulse(elapsed: number, period = 3.4) {
  const t = (elapsed % period) / period;

  if (t < 0.1) {
    return easeOutCubic(t / 0.1);
  }
  if (t < 0.22) {
    return 1;
  }
  if (t < 0.55) {
    return 1 - easeInOutCubic((t - 0.22) / (0.55 - 0.22));
  }
  return 0;
}
