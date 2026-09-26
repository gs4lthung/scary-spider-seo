import { useEffect, useRef, useState } from "react";

/**
 * `value` itself while `throttle` is false; while it is true, the latest `value` sampled at
 * most once every `intervalMs`.
 */
export function useThrottledValue<T>(value: T, throttle: boolean, intervalMs: number): T {
  const [sampled, setSampled] = useState(value);
  const [wasThrottling, setWasThrottling] = useState(throttle);
  // When throttling turns on, start from the current value rather than whatever was sampled
  // during the previous throttled stretch (a previous crawl). Adjusting state while rendering
  // is React's documented pattern for resetting state when a prop changes.
  if (throttle !== wasThrottling) {
    setWasThrottling(throttle);
    if (throttle) setSampled(value);
  }
  const latestRef = useRef(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);
  useEffect(() => {
    if (!throttle) return;
    const id = window.setInterval(() => setSampled(latestRef.current), intervalMs);
    return () => window.clearInterval(id);
  }, [throttle, intervalMs]);
  return throttle && wasThrottling ? sampled : value;
}
