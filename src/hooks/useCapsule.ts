"use client";

import { useEffect, useMemo, useState } from "react";
import { getCapsuleStore, type CapsuleStore } from "@/lib/capsule/store";
import type { CapsuleCrew, CapsuleSession } from "@/lib/capsule/types";

export function useCapsuleStore(sessionId: string): CapsuleStore {
  return useMemo(() => getCapsuleStore(sessionId), [sessionId]);
}

export interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useCapsuleSession(store: CapsuleStore): Live<CapsuleSession | null> {
  const [state, setState] = useState<Live<CapsuleSession | null>>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    setState({ data: null, loading: true, error: null });
    return store.subscribeSession(
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: null, loading: false, error: e.message })
    );
  }, [store]);
  return state;
}

export function useCapsuleCrews(store: CapsuleStore): Live<CapsuleCrew[]> {
  const [state, setState] = useState<Live<CapsuleCrew[]>>({
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    setState({ data: [], loading: true, error: null });
    return store.subscribeCrews(
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message })
    );
  }, [store]);
  return state;
}
