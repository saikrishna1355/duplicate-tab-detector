type DuplicateTabEvent = {
    previousSessionId: string | null;
    newSessionId: string;
    instanceId: string;
};
type DuplicateTabOptions = {
    sessionStorageKey?: string;
    requestKey?: string;
    responseKey?: string;
    /**
     * Called after a duplicate is detected and the session id has been reset.
     */
    onDuplicate?: (event: DuplicateTabEvent) => void;
};
type DuplicateTabState = {
    sessionId: string | null;
    instanceId: string | null;
    duplicateDetected: boolean;
    /**
     * Manually reset the session id for the current tab.
     * Useful if you want to treat the tab as "fresh" without duplicating it.
     */
    resetSession: () => string | null;
};
/**
 * Listen for duplicated browser tabs that share the same `sessionStorage` state.
 * When a duplicate is detected this hook clears the duplicated tab's
 * `sessionStorage`, writes a new session id, and lets you react to the event.
 */
declare function useDuplicateTabSession(options?: DuplicateTabOptions): DuplicateTabState;

export { type DuplicateTabEvent, type DuplicateTabOptions, type DuplicateTabState, useDuplicateTabSession };
