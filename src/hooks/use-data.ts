"use client";

import { useEffect, useState } from "react";
import type { CollectionName } from "@/lib/storage/adapter";
import { subscribe } from "@/lib/storage/db";

/**
 * Loads async data from a repository and reloads whenever any of the given collections change.
 * Components stay independent of which storage adapter is active.
 */
export function useData<T>(load: () => Promise<T>, collections: CollectionName[], initial: T): { data: T; loading: boolean; error: unknown } {
  const [state, setState] = useState<{ data: T; loading: boolean; error: unknown }>({ data: initial, loading: true, error: null });
  const key = collections.join(",");
  useEffect(() => {
    let alive = true;
    const run = () =>
      load().then(
        (data) => alive && setState({ data, loading: false, error: null }),
        (error) => alive && setState((s) => ({ ...s, loading: false, error })),
      );
    run();
    const unsub = subscribe((c) => {
      if (collections.includes(c)) run();
    });
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
