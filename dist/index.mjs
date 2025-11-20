// src/useDuplicateTabSession.ts
import { useCallback, useEffect, useRef, useState } from "react";
var DEFAULT_KEYS = {
  session: "tabSessionId",
  request: "tab-session-request",
  response: "tab-session-response"
};
function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function useDuplicateTabSession(options = {}) {
  const sessionStorageKey = options.sessionStorageKey ?? DEFAULT_KEYS.session;
  const requestKey = options.requestKey ?? DEFAULT_KEYS.request;
  const responseKey = options.responseKey ?? DEFAULT_KEYS.response;
  const onDuplicateRef = useRef(options.onDuplicate);
  onDuplicateRef.current = options.onDuplicate;
  const sessionIdRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [instanceId, setInstanceId] = useState(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const writeSessionId = (value) => {
    sessionIdRef.current = value;
    setSessionId(value);
  };
  const resetSession = useCallback(() => {
    if (typeof window === "undefined") return null;
    const next = createId();
    try {
      window.sessionStorage.setItem(sessionStorageKey, next);
    } catch {
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
      }
      currentSessionId = nextSessionId;
      writeSessionId(nextSessionId);
      setDuplicateDetected(true);
      onDuplicateRef.current?.({
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
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [requestKey, responseKey, sessionStorageKey]);
  return { sessionId, instanceId, duplicateDetected, resetSession };
}
export {
  useDuplicateTabSession
};
