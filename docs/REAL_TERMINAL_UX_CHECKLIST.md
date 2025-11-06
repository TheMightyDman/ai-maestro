# Real Terminal UX: Single‑Pass Development Checklist

Objective
- Deliver a “real terminal” browser UX in a single pass: visible selection, reliable scrollbars, native copy/paste, low-latency rendering, and resilient sessions. No staging/flags; complete end-to-end before release.

Guiding Principles
- Prefer xterm defaults for layering/selection; minimize CSS overrides.
- Keep xterm as scroll authority; tmux copy-mode sync remains opt-in.
- Don’t intercept keyboard when xterm’s helper textarea owns focus.
- Preserve backpressure and rAF-batched writes for smoothness.

Prerequisites
- [ ] tmux installed and accessible.
- [ ] Build gateway: `npm run gateway:build`.
- [ ] Start app: `npm run dev` (single-port proxy and gateway auto-spawn).
- [ ] Generate scrollback: `seq 200 echo hello` to assist validation.

Core Implementation (Single Pass)
1) Layout hardening (consistent viewport + scrollbar)
- [ ] Make terminal container a flex child with `min-h-0` so xterm has a real height.
  - File: `components/TerminalView.tsx`
  - Update wrapper from `className="flex-1 relative"` to `className="flex-1 relative min-h-0"`.
- [ ] Make xterm host block-level and full size (not absolute positioned).
  - File: `components/TerminalView.tsx`
  - Replace `className="absolute inset-0"` with `className="h-full w-full block"`.
- [ ] Replace absolute tab content wrappers with flex + `h-full` + `min-h-0`.
  - File: `app/page.tsx`
  - Change active tab wrapper to `className="flex flex-col h-full"`.
  - Change terminal tab container to `className="flex h-full"`.

2) CSS and layering (selection visibility)
- [ ] Remove/neutralize custom z-index/absolute overrides on xterm canvas to avoid hiding selection overlay.
  - File: `app/globals.css`
  - Remove or comment the rule targeting `.xterm .xterm-screen canvas { position: absolute; z-index: ... }`.
- [ ] Keep internal scrollbar stable on the xterm viewport.
  - Ensure `.xterm .xterm-viewport { overflow-y: auto !important; scrollbar-gutter: stable both-edges; }` remains.

3) Clipboard handling (native feel)
- [ ] In the global keydown handler, if `.xterm-helper-textarea` is focused, do not intercept Cmd/Ctrl+C/V.
  - File: `components/TerminalView.tsx`
  - Early-return when helper is focused; only handle fallbacks when terminal container is focused and helper is not focused.
- [ ] Keep container `onPaste`/`onCopy` fallbacks and continue ignoring events from `.xterm-helper-textarea`.

4) Selection theme
- [ ] Make selection highlight clearly visible with a semi-transparent background.
  - File: `hooks/useTerminal.ts`
  - In the `theme` object, update `selectionBackground` to `rgba(100,116,139,0.35)` (and optionally tune `selectionInactiveBackground`).

5) History replay performance (binary frames)
- [ ] Replace base64 replay with binary frames, mirroring live send path.
  - File: `services/terminal-gateway/src/session/SessionManager.ts`
  - Rework history loop to send `data` descriptors + binary frames (similar to `sendLiveChunk`).
- [ ] Preserve backpressure and acks for replay.
  - Respect `ws.bufferedAmount` / high-water and track `pendingBytes` / `inFlightBytes`.
- [ ] Keep `history-begin` / `history-end` control frames for phase signaling.
- [ ] Update client to mark replay binary frames as `source: 'history'` (not `live`).
  - File: `hooks/useWebSocket.ts`
  - Extend descriptor handling so replay-descriptor sets an internal flag (e.g., `expectedBinaryRef = { seq, size, source: 'history' }`) and pass the correct `source` to `onData`.

6) rAF writes and refresh cadence
- [ ] Validate ~50ms refresh debounce in `components/TerminalView.tsx` under heavy output; adjust for selection feel if needed.

7) Alt-screen + bracketed paste
- [ ] Confirm bracketed paste wrappers are applied on all paste paths; validate behavior in vim, less, htop.

Validation (Single Pass)
- [ ] Selection visibly shades text; Copy button enables and works.
- [ ] Internal terminal scrollbar appears and works; no overlap at the bottom; viewport never collapses.
- [ ] Cmd/Ctrl+V pastes reliably; Cmd/Ctrl+C copies selection; permission prompts do not break UX (fallbacks work).
- [ ] Large histories reach “ready” quickly; no UI stutter during replay.
- [ ] Heavy live output remains smooth; acks continue; no dropped data.
- [ ] Alt-screen tools behave correctly; bracketed paste is correct.

Cross‑Browser QA Matrix
Browsers: Chromium (Mac/Win/Linux), Safari (Mac/iOS), Firefox (Mac/Win/Linux)
- [ ] Selection highlight is visible and accurate.
- [ ] Terminal scrollbar is present and consistent.
- [ ] Clipboard: `navigator.clipboard` path and legacy fallback both validated.
- [ ] WebGL works where available; canvas fallback verified.
- [ ] Touch interactions on mobile are smooth and predictable.

Security & Hardening (Final before release)
- [ ] WS origin validation + token enforcement verified end-to-end.
- [ ] `/term` is the only WS entry on the public port; Next.js upgrade handler path confirmed.
- [ ] CSP appropriate for production; no unnecessary `unsafe-inline`.

Definition Of Done (DoD)
- [ ] Selection highlight clearly visible; copy via keys and UI works.
- [ ] Terminal scrollbar reliable; no bottom overlap; viewport never collapses.
- [ ] Paste via Cmd/Ctrl+V works reliably; fallbacks cover permission prompts.
- [ ] Alt-screen tools and bracketed paste correct; cursor feel is native.
- [ ] Under load, output remains smooth; history replay does not stall the UI.
- [ ] Metrics/activity reflect true session health; reconnection behavior remains robust.

Notes
- WebGL renderer preferred for performance (fallback to canvas on context loss).
- Keep theme minimal; selection colors are the most important for UX clarity.
- Avoid mixing tmux copy-mode scroll with local xterm scroll unless explicitly opted-in.
