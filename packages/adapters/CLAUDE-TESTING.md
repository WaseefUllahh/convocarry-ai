# Claude Adapter - Manual Test Checklist

To ensure the Claude adapter behaves correctly across all edge cases without relying on automated tests that might break with DOM updates, please verify the following manually on [claude.ai](https://claude.ai):

## Extraction Tests
- [ ] **Standard Chat**: Open a standard chat with text-only responses. Verify all user and assistant bubbles are captured.
- [ ] **Code Blocks / Artifacts**: Ask Claude to write code or generate an artifact. Verify the code text is extracted cleanly without HTML garbage.
- [ ] **Empty Chat**: Run extraction on a brand new chat. Should return 0 nodes gracefully or throw the expected structure error.
- [ ] **Timestamp & URL**: Verify the extracted JSON object contains the current `sourceUrl` and a valid ISO 8601 `timestamp`.

## Injection Tests (Critical for Claude)
Claude uses a heavily customized ProseMirror editor. Direct `textContent` manipulation usually fails to activate the "Send" button.
- [ ] **ContentEditable Targeting**: Ensure injection successfully targets the `div[contenteditable="true"]` composer box.
- [ ] **Send Button Activation**: After clicking "Inject Carry Card", the text should appear in the box. **Verify the UP arrow / Send button becomes colored and clickable.** If it remains greyed out, the event simulation failed to alert React.
- [ ] **Newline Preservation**: Inject a multiline text block. Ensure Claude's editor renders the line breaks correctly (this verifies the `execCommand` / `DataTransfer` paste fallback).
- [ ] **Sanitization**: Attempt to inject `<script>alert(1)</script>`. Verify it is injected purely as plain text.

## Best-Effort Account Label
- [ ] **Account Extraction**: Ensure the adapter pulls your name or email from the bottom-left sidebar.
- [ ] **Sidebar Closed**: Collapse the sidebar and run it. It should return `null` and NOT crash.
- [ ] **Debug Mode**: Toggle `DEBUG = true` in `src/claude.ts` and inspect the browser console during the extraction flow to ensure safe failure states.
