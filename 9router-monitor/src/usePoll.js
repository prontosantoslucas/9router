import { useEffect, useRef, useState } from "react";
import { useConfig } from "./store.js";

/** Poll an async fn on an interval; returns { data, error, loading }. */
export function usePoll(fn, deps = []) {
  const refreshMs = useConfig((s) => s.refreshMs);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const d = await fnRef.current();
        if (alive) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    tick();
    const id = setInterval(tick, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, ...deps]);

  return { data, error, loading };
}
