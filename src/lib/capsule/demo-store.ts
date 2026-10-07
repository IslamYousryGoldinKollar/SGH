import type { CapsuleStore, Unsubscribe } from "./store";
import { sampleCrewInput } from "./demo-data";
import {
  DEFAULT_QUESTIONS,
  DEMO_SESSION_ID,
  type CapsuleCrew,
  type CapsuleSession,
} from "./types";

/**
 * Browser-only store for `/capsule/demo`. State lives in localStorage so the phone flow and the
 * big screen can be rehearsed side by side in two tabs of the same browser.
 */

const KEY = "capsule-demo-v1";

interface DemoState {
  session: CapsuleSession;
  crews: CapsuleCrew[];
}

const freshState = (): DemoState => ({
  session: {
    id: DEMO_SESSION_ID,
    title: "The Culture Capsule (demo)",
    adminId: "demo",
    status: "open",
    questions: DEFAULT_QUESTIONS,
    expectedCrews: 25,
    createdAt: Date.now(),
    themes: null,
    letter: null,
  },
  crews: [],
});

function read(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* fall through to a fresh state */
  }
  return freshState();
}

const listeners = new Set<() => void>();
let memory: DemoState | null = null; // fallback when localStorage is unavailable/full

function write(state: DemoState) {
  memory = state;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or privacy mode: keep working in memory for this tab */
  }
  listeners.forEach((l) => l());
}

const current = (): DemoState => memory ?? read();

export function createDemoStore(): CapsuleStore {
  const subscribe = (fn: () => void): Unsubscribe => {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        memory = null; // another tab wrote: re-read
        fn();
      }
    };
    window.addEventListener("storage", onStorage);
    // Fire once asynchronously so callers can finish wiring state first.
    const t = window.setTimeout(fn, 0);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(t);
    };
  };

  return {
    isDemo: true,
    subscribeSession(cb) {
      return subscribe(() => cb(current().session));
    },
    subscribeCrews(cb) {
      return subscribe(() => cb(current().crews));
    },
    async submitCrew(input) {
      const state = current();
      const id = `demo-${Date.now().toString(36)}-${state.crews.length}`;
      write({ ...state, crews: [...state.crews, { ...input, id, createdAt: Date.now() }] });
      return id;
    },
    async setStatus(status) {
      const s = current();
      write({ ...s, session: { ...s.session, status } });
    },
    async saveThemes(themes) {
      const s = current();
      write({ ...s, session: { ...s.session, themes } });
    },
    async saveLetter(letter) {
      const s = current();
      write({ ...s, session: { ...s.session, letter } });
    },
    async clearLetter() {
      const s = current();
      write({ ...s, session: { ...s.session, letter: null } });
    },
    async deleteCrew(crewId) {
      const s = current();
      write({ ...s, crews: s.crews.filter((c) => c.id !== crewId) });
    },
    async addSampleCrew() {
      const s = current();
      const input = sampleCrewInput(s.crews.length);
      const id = `demo-${Date.now().toString(36)}-${s.crews.length}`;
      write({ ...s, crews: [...s.crews, { ...input, id, createdAt: Date.now() }] });
    },
    async resetDemo() {
      write(freshState());
    },
  };
}
