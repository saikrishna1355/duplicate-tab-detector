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
