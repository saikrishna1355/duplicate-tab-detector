# duplicate-tab-detector

React hook that spots duplicated browser tabs, clears the duplicated tab's `sessionStorage`, and assigns a fresh session id so each tab stays isolated.

## Install

```bash
npm install duplicate-tab-detector
```

## Usage

Pick the style that fits your app:

- **Side-effect only (no lint warnings):** starts detection as soon as the module loads.
  ```tsx
  import "duplicate-tab-detector";
  ```
- **Hook with UI:** use the hook to render state or add your own handler.
  ```tsx
  import { useDuplicateTabSession } from "duplicate-tab-detector";
  ```

Full example with a simple UI:

```tsx
import { useDuplicateTabSession } from "duplicate-tab-detector";

export function App() {
  const { sessionId, instanceId, duplicateDetected, resetSession } =
    useDuplicateTabSession({
      onDuplicate: ({ previousSessionId, newSessionId }) => {
        console.log("Duplicate detected", { previousSessionId, newSessionId });
      },
    });

  return (
    <div>
      <p>Session id: {sessionId ?? "loading..."}</p>
      <p>Instance id: {instanceId ?? "loading..."}</p>
      <p>
        Status:{" "}
        {duplicateDetected
          ? "Duplicate tab detected; sessionStorage was cleared for this tab."
          : "No duplicate detected for this tab."}
      </p>
      <button onClick={resetSession}>Reset session id manually</button>
    </div>
  );
}
```

If you prefer to start detection manually (for example, outside of React) you can
call `startDuplicateTabSession()` from the package entry point.

### Behavior at a glance (for developers)

- The first import starts listening for duplicate tabs and broadcasts via `localStorage`.
- A duplicated tab clears its own `sessionStorage`, writes a fresh session id, and sets `duplicateDetected` to `true`.
- Storage failures (private mode, disabled storage) are tolerated by falling back to in-memory ids.
- SSR is safe: when `window` is missing, the hook returns `null` state until the browser hydrates.

### Options

- `sessionStorageKey` (default `tabSessionId`): key used to store the per-tab session id.
- `requestKey` (default `tab-session-request`): `localStorage` key used to broadcast duplicate-detection requests.
- `responseKey` (default `tab-session-response`): `localStorage` key used to answer duplicate-detection requests.
- `onDuplicate`: callback invoked after a duplicate is detected and the session id is reset.

### What it does

- Creates a per-tab session id (kept across reloads via `sessionStorage`).
- When a tab is duplicated, the new tab broadcasts via `localStorage` and receives a response from the original tab.
- Upon detecting that it is a duplicate, the duplicated tab clears its own `sessionStorage`, generates a new session id, and updates state.
- Works even when storage is unavailable (privacy modes) by falling back to in-memory ids.

### Notes

- The hook only runs in the browser; server-side renders simply see the initial `null` values until hydration.
- The package ships both ESM and CJS builds; TypeScript typings are included.
