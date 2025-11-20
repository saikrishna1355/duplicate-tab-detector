"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  useDuplicateTabSession: () => useDuplicateTabSession
});
module.exports = __toCommonJS(index_exports);

// src/useDuplicateTabSession.ts
var import_react = require("react");
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
  const onDuplicateRef = (0, import_react.useRef)(options.onDuplicate);
  onDuplicateRef.current = options.onDuplicate;
  const sessionIdRef = (0, import_react.useRef)(null);
  const [sessionId, setSessionId] = (0, import_react.useState)(null);
  const [instanceId, setInstanceId] = (0, import_react.useState)(null);
  const [duplicateDetected, setDuplicateDetected] = (0, import_react.useState)(false);
  const writeSessionId = (value) => {
    sessionIdRef.current = value;
    setSessionId(value);
  };
  const resetSession = (0, import_react.useCallback)(() => {
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
  (0, import_react.useEffect)(() => {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  useDuplicateTabSession
});
