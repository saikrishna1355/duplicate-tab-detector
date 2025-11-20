import { useCallback, useEffect, useRef, useState } from "react";

export type DuplicateTabEvent = {
  previousSessionId: string | null;
  newSessionId: string;
  instanceId: string;
};

export type DuplicateTabOptions = {
  sessionStorageKey?: string;
  requestKey?: string;
  responseKey?: string;
  /**
   * Called after a duplicate is detected and the session id has been reset.
   */
  onDuplicate?: (event: DuplicateTabEvent) => void;
};

export type DuplicateTabState = {
  sessionId: string | null;
  instanceId: string | null;
  duplicateDetected: boolean;
  /**
   * Manually reset the session id for the current tab.
   * Useful if you want to treat the tab as "fresh" without duplicating it.
   */
  resetSession: () => string | null;
};

const DEFAULT_KEYS = {
  session: "tabSessionId",
  request: "tab-session-request",
  response: "tab-session-response",
} as const;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Listen for duplicated browser tabs that share the same `sessionStorage` state.
 * When a duplicate is detected this hook clears the duplicated tab's
 * `sessionStorage`, writes a new session id, and lets you react to the event.
 */
export function useDuplicateTabSession(
  options: DuplicateTabOptions = {},
): DuplicateTabState {
  const sessionStorageKey = options.sessionStorageKey ?? DEFAULT_KEYS.session;
  const requestKey = options.requestKey ?? DEFAULT_KEYS.request;
  const responseKey = options.responseKey ?? DEFAULT_KEYS.response;

  const onDuplicateRef = useRef(options.onDuplicate);
  onDuplicateRef.current = options.onDuplicate;

  const sessionIdRef = useRef<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);

  const writeSessionId = (value: string) => {
    sessionIdRef.current = value;
    setSessionId(value);
  };

  const resetSession = useCallback(() => {
    if (typeof window === "undefined") return null;

    const next = createId();
    try {
      window.sessionStorage.setItem(sessionStorageKey, next);
    } catch {
      // Ignore write errors (e.g. disabled storage)
    }
    writeSessionId(next);
    setDuplicateDetected(false);
    return next;
  }, [sessionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let handledDuplicate = false;
    let active = true;

    const ensureSessionId = () => {
      try {
        const existing = window.sessionStorage.getItem(sessionStorageKey);
        if (existing) {
          writeSessionId(existing);
          return existing;
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
    setInstanceId(currentInstanceId);

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
      setDuplicateDetected(true);

      onDuplicateRef.current?.({
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

    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [requestKey, responseKey, sessionStorageKey]);

  return { sessionId, instanceId, duplicateDetected, resetSession };
}
