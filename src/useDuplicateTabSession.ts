import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DuplicateTabSessionController,
  DEFAULT_KEYS,
  startDuplicateTabSession,
} from "./sessionManager";
import { DuplicateTabOptions, DuplicateTabState } from "./types";

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

  const controller: DuplicateTabSessionController = useMemo(
    () =>
      startDuplicateTabSession({
        sessionStorageKey,
        requestKey,
        responseKey,
      }),
    [sessionStorageKey, requestKey, responseKey],
  );

  useEffect(() => {
    controller.setOnDuplicate(options.onDuplicate);
  }, [controller, options.onDuplicate]);

  const subscribe = useMemo(
    () => (onStoreChange: () => void) => controller.subscribe(onStoreChange),
    [controller],
  );
  const getSnapshot = useMemo(() => controller.getState, [controller]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Ensure resetSession identity is stable across renders for consumers.
  const resetSession = useCallback(() => controller.resetSession(), [controller]);

  return { ...state, resetSession };
}
