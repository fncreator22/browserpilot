# Browser Agent Core Specification

## 1. The 8 Core v1 Browser Tools
The browser agent interacts with web pages strictly through a sandboxed, deterministic set of 8 discrete tools:

1. **`browser.navigate`**
   - **Signature**: `{ url: string }`
   - **Behavior**: Navigates the current page context to the specified HTTP/HTTPS URL. Waits for `domcontentloaded` or `networkidle` state.
2. **`browser.inspect`**
   - **Signature**: `{ selector?: string, depth?: number }`
   - **Behavior**: Retrieves a simplified, accessibility-annotated DOM tree or structural representation of interactive elements matching the selector or viewport.
3. **`browser.click`**
   - **Signature**: `{ selector: string }`
   - **Behavior**: Dispatches a click event to the target element identified by CSS selector, text match, or accessibility label.
4. **`browser.fill`**
   - **Signature**: `{ selector: string, value: string }`
   - **Behavior**: Clears existing input content and fills the target input/textarea with the specified string value.
5. **`browser.press`**
   - **Signature**: `{ key: string }`
   - **Behavior**: Dispatches keyboard press events (e.g., `Enter`, `Tab`, `Escape`, `ArrowDown`).
6. **`browser.extractText`**
   - **Signature**: `{ selector?: string }`
   - **Behavior**: Extracts sanitized, visible text content from the specified selector or the entire document body.
7. **`browser.screenshot`**
   - **Signature**: `{ fullPage?: boolean }`
   - **Behavior**: Captures a PNG/JPEG screenshot of the current page viewport or entire document and stores it in artifact storage.
8. **`browser.getState`**
   - **Signature**: `{}`
   - **Behavior**: Retrieves metadata about the current page state, including URL, title, HTTP status, loading status, scroll coordinates, and visible interactive element counts.

---

## 2. Action Schema Shape
Every action proposed by the LLM planner follows a structured JSON schema:

```json
{
  "tool": "browser.click",
  "parameters": {
    "selector": "button[type='submit']"
  },
  "rationale": "Submitting the search query after filling the input field."
}
```

---

## 3. Observation Return Format
After each tool execution, the worker returns a standardized observation payload back to the agent reasoning loop:

```json
{
  "stepIndex": 3,
  "action": {
    "tool": "browser.click",
    "parameters": { "selector": "button[type='submit']" }
  },
  "status": "SUCCESS",
  "currentUrl": "https://example.com/search?q=query",
  "title": "Search Results - Example",
  "pageSummary": "Found 12 matching results. First result: Example Item...",
  "screenshotPath": "storage/artifacts/jobs/job_123/step_3.png",
  "error": null,
  "elapsedMs": 420
}
```

---

## 4. Timeout & Safety Boundaries
- **Navigation Timeout**: Maximum 30 seconds per navigation action.
- **Selector Timeout**: Maximum 5 seconds for element resolution before throwing a selector-not-found error.
- **Action Step Timeout**: Maximum 15 seconds per individual action.
- **Overall Job Timeout**: Hard cap of 300 seconds (5 minutes) or 25 total steps per execution run.
- **Retry Policy**: Maximum 2 automatic retries for transient network/stale-element failures before triggering human escalation or job failure.

---

## 5. Explicitly Deferred Tools (Post-v1 Roadmap)
The following capabilities are **explicitly excluded** from the v1 MVP to guarantee safety, deterministic state machines, and reliable sandboxing:
- ❌ **`browser.select`**: Multi-select dropdown manipulation (handle via standard click + press in v1).
- ❌ **`browser.scroll`**: Arbitrary pixel-based scrolling (v1 focuses on direct selector targeting and element visibility scrolling).
- ❌ **`browser.download`**: Arbitrary file downloading to local filesystem.
- ❌ **`browser.upload`**: Arbitrary local file upload dispatch.
