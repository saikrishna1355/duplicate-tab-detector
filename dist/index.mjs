// src/sessionManager.ts
var DEFAULT_KEYS = {
  session: "tabSessionId",
  request: "tab-session-request",
  response: "tab-session-response"
};
var controllers = /* @__PURE__ */ new Map();
var createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
var getKey = (sessionStorageKey, requestKey, responseKey) => [sessionStorageKey, requestKey, responseKey].join("|");
function startDuplicateTabSession(options = {}) {
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
  let sessionId = null;
  let instanceId = null;
  let duplicateDetected = false;
  const listeners = /* @__PURE__ */ new Set();
  const resetSession = () => {
    if (typeof window === "undefined") return null;
    const next = createId();
    try {
      window.sessionStorage.setItem(sessionStorageKey, next);
    } catch {
    }
    sessionId = next;
    duplicateDetected = false;
    notify();
    return next;
  };
  const snapshot = () => ({
    sessionId,
    instanceId,
    duplicateDetected,
    resetSession
  });
  const notify = () => {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
  };
  const subscribe = (listener) => {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  };
  const controller = {
    getState: snapshot,
    subscribe,
    resetSession,
    setOnDuplicate: (handler) => {
      onDuplicate = handler;
    }
  };
  controllers.set(controllerKey, controller);
  if (typeof window !== "undefined") {
    let handledDuplicate = false;
    let active = true;
    const writeSessionId = (value) => {
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
      }
      currentSessionId = nextSessionId;
      writeSessionId(nextSessionId);
      duplicateDetected = true;
      notify();
      onDuplicate?.({
        previousSessionId: previous,
        newSessionId: nextSessionId,
        instanceId: currentInstanceId
      });
    };
    const onStorage = (event) => {
      if (!event.key || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (event.key === requestKey) {
          if (payload.sessionId === currentSessionId && payload.instanceId !== currentInstanceId) {
            const response = JSON.stringify({
              sessionId: currentSessionId,
              fromInstanceId: currentInstanceId,
              toInstanceId: payload.instanceId,
              timestamp: Date.now()
            });
            try {
              window.localStorage.setItem(responseKey, response);
            } catch {
            }
          }
        } else if (event.key === responseKey) {
          if (payload.toInstanceId === currentInstanceId && payload.sessionId === currentSessionId) {
            handleDuplicate();
          }
        }
      } catch {
      }
    };
    window.addEventListener("storage", onStorage);
    try {
      const request = JSON.stringify({
        sessionId: currentSessionId,
        instanceId: currentInstanceId,
        timestamp: Date.now()
      });
      window.localStorage.setItem(requestKey, request);
    } catch {
    }
    const cleanup = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("storage", onStorage);
    };
    controller.stop = cleanup;
  }
  return controller;
}

// src/useDuplicateTabSession.ts
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
function useDuplicateTabSession(options = {}) {
  const sessionStorageKey = options.sessionStorageKey ?? DEFAULT_KEYS.session;
  const requestKey = options.requestKey ?? DEFAULT_KEYS.request;
  const responseKey = options.responseKey ?? DEFAULT_KEYS.response;
  const controller = useMemo(
    () => startDuplicateTabSession({
      sessionStorageKey,
      requestKey,
      responseKey
    }),
    [sessionStorageKey, requestKey, responseKey]
  );
  useEffect(() => {
    controller.setOnDuplicate(options.onDuplicate);
  }, [controller, options.onDuplicate]);
  const subscribe = useMemo(
    () => (onStoreChange) => controller.subscribe(onStoreChange),
    [controller]
  );
  const getSnapshot = useMemo(() => controller.getState, [controller]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const resetSession = useCallback(() => controller.resetSession(), [controller]);
  return { ...state, resetSession };
}

// src/index.ts
startDuplicateTabSession();
export {
  useDuplicateTabSession as default,
  startDuplicateTabSession,
  useDuplicateTabSession
};
