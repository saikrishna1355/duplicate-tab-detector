import { DuplicateTabOptions, DuplicateTabState } from "./types";

const DEFAULT_KEYS = {
  session: "tabSessionId",
  request: "tab-session-request",
  response: "tab-session-response",
} as const;

export type DuplicateTabSessionController = {
  getState: () => DuplicateTabState;
  subscribe: (listener: (state: DuplicateTabState) => void) => () => void;
  resetSession: () => string | null;
  setOnDuplicate: (handler?: DuplicateTabOptions["onDuplicate"]) => void;
  stop?: () => void;
};

const controllers = new Map<string, DuplicateTabSessionController>();

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getKey = (sessionStorageKey: string, requestKey: string, responseKey: string) =>
  [sessionStorageKey, requestKey, responseKey].join("|");

export function startDuplicateTabSession(
  options: DuplicateTabOptions = {},
): DuplicateTabSessionController {
  const sessionStorageKey = options.sessionStorageKey ?? DEFAULT_KEYS.session;
  const requestKey = options.requestKey ?? DEFAULT_KEYS.request;
  const responseKey = options.responseKey ?? DEFAULT_KEYS.response;
  const controllerKey = getKey(sessionStorageKey, requestKey, responseKey);

  const existing = controllers.get(controllerKey);
  if (existing) {
    existing.setOnDuplicate(options.onDuplicate);
    return existing;
  }

  let onDuplicate = options.onDuplicate;
  let sessionId: string | null = null;
  let instanceId: string | null = null;
  let duplicateDetected = false;

  const listeners = new Set<(state: DuplicateTabState) => void>();

  const resetSession = (): string | null => {
    if (typeof window === "undefined") return null;

    const next = createId();
    try {
      window.sessionStorage.setItem(sessionStorageKey, next);
    } catch {
      // Ignore write errors (e.g. disabled storage)
    }
    sessionId = next;
    duplicateDetected = false;
    notify();
    return next;
  };

  const snapshot = (): DuplicateTabState => ({
    sessionId,
    instanceId,
    duplicateDetected,
    resetSession,
  });

  const notify = () => {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
  };

  const subscribe = (listener: (state: DuplicateTabState) => void) => {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  };

  const controller: DuplicateTabSessionController = {
    getState: snapshot,
    subscribe,
    resetSession,
    setOnDuplicate: (handler?: DuplicateTabOptions["onDuplicate"]) => {
      onDuplicate = handler;
    },
  };

  controllers.set(controllerKey, controller);

  if (typeof window !== "undefined") {
    let handledDuplicate = false;
    let active = true;

    const writeSessionId = (value: string) => {
      sessionId = value;
      notify();
    };

    const ensureSessionId = () => {
      try {
        const existingSessionId = window.sessionStorage.getItem(sessionStorageKey);
        if (existingSessionId) {
          writeSessionId(existingSessionId);
          return existingSessionId;
        }
        const next = createId();
        window.sessionStorage.setItem(sessionStorageKey, next);
        writeSessionId(next);
        return next;
      } catch {
        const fallback = createId();
        writeSessionId(fallback);
        return fallback;
      }
    };

    const currentInstanceId = createId();
    instanceId = currentInstanceId;
    notify();

    let currentSessionId = ensureSessionId();

    const handleDuplicate = () => {
      if (!active || handledDuplicate) return;
      handledDuplicate = true;

      const previous = currentSessionId;
      const nextSessionId = createId();

      try {
        window.sessionStorage.clear();
        window.sessionStorage.setItem(sessionStorageKey, nextSessionId);
      } catch {
        // Ignore when sessionStorage is blocked or unavailable
      }

      currentSessionId = nextSessionId;
      writeSessionId(nextSessionId);
      duplicateDetected = true;
      notify();

      onDuplicate?.({
        previousSessionId: previous,
        newSessionId: nextSessionId,
        instanceId: currentInstanceId,
      });
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue as string);

        if (event.key === requestKey) {
          if (
            payload.sessionId === currentSessionId &&
            payload.instanceId !== currentInstanceId
          ) {
            const response = JSON.stringify({
              sessionId: currentSessionId,
              fromInstanceId: currentInstanceId,
              toInstanceId: payload.instanceId,
              timestamp: Date.now(),
            });
            try {
              window.localStorage.setItem(responseKey, response);
            } catch {
              // Ignore if localStorage is blocked
            }
          }
        } else if (event.key === responseKey) {
          if (
            payload.toInstanceId === currentInstanceId &&
            payload.sessionId === currentSessionId
          ) {
            handleDuplicate();
          }
        }
      } catch {
        // Ignore malformed payloads and storage errors
      }
    };

    window.addEventListener("storage", onStorage);

    try {
      const request = JSON.stringify({
        sessionId: currentSessionId,
        instanceId: currentInstanceId,
        timestamp: Date.now(),
      });
      window.localStorage.setItem(requestKey, request);
    } catch {
      // Ignore if localStorage is blocked
    }

    const cleanup = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("storage", onStorage);
    };

    // Expose cleanup on controller to allow tests or advanced consumers to stop listeners.
    controller.stop = cleanup;
  }

  return controller;
}

export { DEFAULT_KEYS };
