# ChatGPT Adapter - Manual Test Checklist

To ensure the ChatGPT adapter behaves correctly across all edge cases without relying on automated integration tests that might break with DOM updates, please verify the following manually:

## Extraction Tests
- [ ] **Standard Chat**: Open a standard chat with text-only responses. Verify all user and assistant bubbles are captured.
- [ ] **Code Blocks**: Ask ChatGPT to write code. Verify the code text is extracted cleanly without `<span>` or class garbage.
- [ ] **Empty Chat**: Run extraction on a brand new chat with no messages. Should return 0 nodes gracefully or throw the expected structure error.
- [ ] **Legacy URLs**: Test on `chatgpt.com` and `chat.openai.com` to ensure the regex detection fires.
- [ ] **Timestamp & URL**: Verify the extracted JSON object contains the current `sourceUrl` and a valid ISO 8601 `timestamp`.

## Injection Tests
- [ ] **Textarea Targeting**: Ensure injection finds `#prompt-textarea`.
- [ ] **ContentEditable Targeting**: (If applicable on new UI versions) Ensure injection finds the `.ProseMirror` composer.
- [ ] **React State Update**: After clicking "Inject Carry Card", the text should appear in the input box. Ensure the "Send" arrow button becomes active (this proves the native setter bypass worked and React registered the state change).
- [ ] **Multiline Injection**: Inject a Carry Card containing multiple paragraphs. Ensure formatting is preserved in the composer.
- [ ] **Sanitization**: Attempt to inject `<script>alert(1)</script>`. Verify it is injected as raw text and does not execute.

## Best-Effort Account Label
- [ ] **Account Name Extraction**: Ensure the adapter successfully pulls the account name from the bottom-left sidebar button or profile menu.
- [ ] **No-Crash Guarantee**: If the sidebar is closed or the DOM changes completely, ensure `getActiveAccountLabel()` simply returns `null` and does not crash the extraction flow.
- [ ] **Debug Mode**: Toggle `DEBUG = true` in `src/chatgpt.ts` and check the browser console for safe logging traces during execution.
