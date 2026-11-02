import { useEffect, useState } from "react";
export function useCountdown(initial: number, active = true) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    if (seconds === 0 || !active) return;
    const timer = setTimeout(() => setSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds, active]);
  return { seconds, restart: () => setSeconds(initial) };
}
