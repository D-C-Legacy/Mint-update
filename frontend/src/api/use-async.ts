import { useCallback, useEffect, useState } from "react";
import { describeApiError } from "./describe-error";

export type Async<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

// Runs `load` when `deps` change, and keeps the result as loading / ready / error. A late response
// from an earlier request is ignored, so a fast change of filter never shows stale data.
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<Async<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    load()
      .then((data) => {
        if (alive) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (alive) setState({ status: "error", message: describeApiError(err) });
      });
    return () => {
      alive = false;
    };
    // The caller owns `deps`; `load` is recreated every render on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
