import { startDuplicateTabSession } from "./sessionManager";

// Automatically start duplicate tab detection on import so consumers can use a
// bare side-effect import (`import "duplicate-tab-detector";`) without lint
// warnings about unused variables.
startDuplicateTabSession();

export * from "./types";
export { startDuplicateTabSession } from "./sessionManager";
export * from "./useDuplicateTabSession";
export { useDuplicateTabSession as default } from "./useDuplicateTabSession";
