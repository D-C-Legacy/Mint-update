import { useEffect, useRef, useState } from "react";
import { MOCK_CONFIG } from "../constants";
export function useMockSubmit() {
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function submit(callback: () => void) {
    if (timer.current) return;
    setLoading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setLoading(false);
      callback();
    }, MOCK_CONFIG.submissionMs);
  }
  return { loading, submit };
}
