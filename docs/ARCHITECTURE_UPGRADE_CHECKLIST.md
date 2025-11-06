# AI Maestro Architecture Upgrade Checklist

This document captures a single-pass, high-impact set of architectural improvements to substantially increase reliability, performance, and future deployability of AI Maestro. It includes an OS-focused preamble, a rationale for change, and an actionable checklist with acceptance criteria and validation steps.

---

## Preamble: Operating System Context and Rationale

AI Maestro uses `tmux` and `node-pty` to host interactive terminal sessions in the browser. This approach relies on POSIX terminals and is supported on Unix-like systems (Linux, macOS). In practice, production deployments typically run on Linux (e.g., Debian/Ubuntu), while developers often use macOS locally. Key OS-related characteristics that motivate the changes below:

- TTY/PTY behavior: `node-pty` and `tmux` interact with the operating system’s pseudo-terminal subsystem. Large bursts of output or slow clients can stress the event loop if not backpressured.
- Process management: Long-running processes benefit from isolation (separate service) to avoid coupling UI rendering with PTY I/O, and to simplify supervised restarts (PM2/systemd).
- Filesystem and paths: Session logs and ring buffers are stored on local disk or memory; predictable Linux paths and permissions simplify rotation and monitoring.
- Signals and shutdown: Graceful shutdown (SIGTERM) should ensure PTYs are terminated and buffers/logs flushed; Linux process models make this more predictable in production.

Why change now
- Remove synchronous/blocking calls in hot paths to stop event-loop stalls and jitter.
- Introduce a robust terminal data pipeline (ring buffer + protocol) for consistent reconnects, multi-viewers, and high output.
- Add explicit flow control to prevent memory growth and preserve snappy rendering under load.
- Isolate terminal gateway from the web UI for better resilience, security boundaries, and flexible deployments.

---

## Summary of Objectives

- Isolate PTY + WebSocket from Next.js UI (Terminal Gateway service).
- Add server-side history ring buffer; eliminate tmux capture from hot paths.
- Introduce explicit protocol (binary data + JSON control), with acks, heartbeats, and resize leadership.
- Improve client rendering: batched writes and WebGL renderer.
- Add observability, metrics, and safety policies for slow clients.

---

## Checklist (Implementation Steps)

1) Terminal Gateway (separate service)
- [x] Create `services/terminal-gateway/` with:
  - [x] `src/index.ts` (WS server bootstrap)
  - [x] `src/session/SessionManager.ts` (session lifecycle, clients, leader, metrics)
  - [x] `src/session/PtySession.ts` (wrap `node-pty`, pause/resume, resize, lifecycle)
  - [x] `src/session/RingBuffer.ts` (append-only circular buffer of raw PTY bytes)
  - [x] `src/protocol/messages.ts` + `src/protocol/schema.ts` (zod-validated control messages)
  - [x] `src/auth.ts` (token verification, origin checks)
  - [x] `src/metrics.ts` (counters + optional HTTP `/metrics`)
- [x] Listen on `TERMINAL_WS_PORT` (default `23001`).
- [x] Enable `perMessageDeflate`, set `maxPayload` appropriately.

Acceptance criteria
- [x] Next.js process contains no PTY/WS handling; it continues to serve UI and REST APIs.
- [x] Gateway handles attach/detach independently and can be restarted without killing the UI.

- [x] Use WS subprotocol: `Sec-WebSocket-Protocol: maestro.v1`.
- [x] Binary frames (opcode 2) for PTY data only.
- [x] Text frames for control messages (JSON; validated by zod):
  - [ ] `hello { version, token? }`, `ok { features }`, `error { code, message }`
  - [ ] `ping { ts }`, `pong { ts }`
  - [ ] `join { sessionName }`
  - [ ] `history-begin { bytes }`, `history-chunk { seq, dataBase64 }`, `history-end`
  - [ ] `resize { cols, rows }` (only from leader)
  - [ ] `leader-claim { clientId }`, `leader-change { clientId|null }`
  - [ ] `set-logging { enabled }`
  - [ ] `ack { upToSeq }` (client → server)

Acceptance criteria
- [x] Client sets `ws.binaryType = 'arraybuffer'.
- [x] No JSON parsing is attempted on binary frames.
- [x] Control messages are schema-validated and rejected with explicit `error` frames.

- [x] Implement fixed-size circular buffer per session (default 32MB; env-configurable via `TERMINAL_RING_BYTES`).
- [x] Append raw PTY bytes as received (ANSI intact).
- [x] On client join, replay last N bytes:
  - [ ] Send `history-begin` with byte count.
  - [ ] Send `history-chunk` sequences until caught up.
  - [ ] Send `history-end`, then switch to live binary frames.
- [ ] Fallback: if ring is empty (first-ever attach), perform async `tmux capture-pane`, write into ring once, then proceed.

Acceptance criteria
- [x] New connections display consistent scrollback immediately without blocking the event loop.
- [x] No synchronous `tmux` calls in hot paths.

4) Flow Control (backpressure & credits)
- [x] Per-client send queues and global sequence counter.
- [x] Monitor `ws.bufferedAmount` and outstanding (unacked) bytes.
- [x] Configure thresholds (`TERMINAL_HIGH_WATER`, `TERMINAL_LOW_WATER`):
  - [x] Pause PTY when any client exceeds HIGH_WATER or window budget.
  - [x] Resume PTY when all clients drop below LOW_WATER and/or acks advance.
- [x] Client sends `ack { upToSeq }` on intervals or after visible flushes.
- [ ] Optional policy: mark chronically slow clients as “replay-only” temporarily.

Acceptance criteria
- [ ] Under heavy output, memory stays bounded and PTY resumes promptly when clients drain.
- [ ] No UI freezes; no dropped frames without policy logs.

5) Resize Leadership
- [x] Track `resizeLeader: clientId|null` per session.
- [x] First active client can auto-claim or users can claim via UI.
- [x] Only leader’s `resize` is applied; others are ignored.
- [x] Broadcast `leader-change` to all clients.

Acceptance criteria
- [ ] With multiple viewers at different sizes, PTY resizes only follow the leader, avoiding flicker.

6) Heartbeats & Liveness
- [x] Server sends `ping` every 15s; requires `pong` within 30s.
- [x] Disconnect stale clients; free resources immediately.

Acceptance criteria
- [ ] Half-open connections do not persist; reconnection logic works reliably.

7) Client Updates (UI)
- [x] `hooks/useWebSocket.ts`:
  - [x] Connect to `NEXT_PUBLIC_TERMINAL_WS_URL` (e.g., `ws://localhost:23001/term`).
  - [x] Set `binaryType = 'arraybuffer'.
  - [x] On open: send `hello` → `join`.
  - [x] On message: binary → enqueue terminal writes; text → handle control (history, leader, ping/pong, errors, stats); send `ack` periodically.
- [x] `components/TerminalView.tsx`:
  - [x] Batched writes: collect chunks and flush every ~16ms (rAF or setTimeout) to `terminal.write()`.
  - [x] Load `@xterm/addon-webgl` with fallback to canvas.
  - [x] Only send `resize` if leader; expose UI indicator/toggle.
- [x] `hooks/useTerminal.ts`:
  - [x] Keep `convertEol: false` (PTY correctness).
  - [x] Keep resize observer debounce and minimal `refresh()` usage.

Acceptance criteria
- [ ] Smooth rendering during bursts (no yellow selection glitches, overlays stay aligned).
- [ ] Stable reconnects without tearing or stale layers.

8) Next.js Server Cleanup
- [x] Remove (or feature-flag off) legacy WS `/term` from `server.mjs`.
- [x] Update REST APIs to use async `lib/tmux.ts` helpers only.
- [x] Add `NEXT_PUBLIC_TERMINAL_WS_URL` and gateway envs.

Acceptance criteria
- [ ] Next process cannot stall due to PTY/WS.
- [ ] All tmux interactions from REST are async and bounded with timeouts.

9) Security
- [x] Authenticate WS handshake using token (from `hello`) against `TERMINAL_WS_TOKEN`.
- [x] Validate `Origin`/`Host`; enforce same-origin or allowed list.
- [x] Rate-limit connections per IP/session; cap max clients per session.
- [x] Validate session names strictly on server before any tmux action.

Acceptance criteria
- [ ] Unauthorized clients are rejected with explicit `error` and closed.
- [ ] Abuse does not degrade service for authorized clients.

10) Observability & Logging
- [x] Structured logs (JSON) with `sessionName`, `clientId`, `event`, `bytes`, `seq`.
- [x] Metrics: clients, bytesOut, replayBytes, maxBufferedAmount, pauses/resumes, acks/sec, ping latency.
- [x] Optional `/metrics` endpoint (Prometheus) protected by token.
- [ ] Log rotation for session logs if disk logging is enabled.

Acceptance criteria
- [ ] Operators can troubleshoot slow clients, high output, and abnormal disconnects quickly.

11) Configuration & Process Management
- [x] Add envs:
  - [x] `TERMINAL_WS_PORT=23001`
  - [x] `TERMINAL_WS_TOKEN=change-me`
  - [x] `TERMINAL_RING_BYTES=33554432` (32MB)
  - [x] `TERMINAL_HIGH_WATER=2097152` (2MB)
  - [x] `TERMINAL_LOW_WATER=524288` (512KB)
  - [x] `NEXT_PUBLIC_TERMINAL_WS_URL=ws://localhost:23001/term`
- [x] Add PM2 (or systemd) process entry for gateway; ensure graceful shutdown.

Acceptance criteria
- [ ] One-command start for UI and Gateway; clean stop with PTY termination and buffer flush.

---

## Acceptance Criteria (End-to-End)
- [ ] No synchronous `tmux` calls in WS or request hot paths.
- [ ] New client connect shows immediate history via ring buffer without blocking.
- [ ] Under heavy output, PTY pauses/resumes predictably; memory remains bounded; UI remains responsive.
- [ ] With multiple viewers, only leader resizes affect PTY.
- [ ] Reconnects consistently recreate terminal view without artifacts.
- [ ] Heartbeats close stale sockets; reconnection works.
- [ ] Metrics and logs provide clear insight into throughput and backpressure.

---

## Validation Scenarios

Functional
- [ ] Open vim, less, htop; switch in/out; verify cursor, alt-screen, and selection behavior.
- [ ] Multi-viewer resize: two browsers at different sizes; confirm leader-only resize.
- [ ] Reconnects: refresh page; kill WS; restart gateway; verify seamless recovery.

Throughput & Backpressure
- [ ] Stream large output (e.g., `yes | head -c 5e6`); confirm no UI stalls, bounded memory, and proper PTY pause/resume.
- [ ] Simulate slow client (network throttle); verify backpressure and policy actions; other clients remain smooth.

Liveness & Security
- [ ] Drop network mid-session; verify ping/pong timeouts close the socket and client auto-reconnects.
- [ ] Attempt unauthorized connect; verify rejection and clear error.

Observability
- [ ] Inspect metrics/logs: bytesOut, replayBytes, acks/sec, ping latency, pause/resume counters.

---

## Rollout Plan
- [ ] Ship gateway alongside UI; point UI to gateway via `NEXT_PUBLIC_TERMINAL_WS_URL`.
- [ ] Keep legacy WS behind a feature flag during burn-in; remove after confidence.
- [ ] Monitor metrics/logs for a full cycle under real workloads.

---

## Operating System Notes

- Linux (Debian/Ubuntu) recommended for production:
  - Prefer PM2/systemd to supervise gateway and UI processes.
  - Ensure `tmux` is installed and TERM/locale configured (e.g., `xterm-256color`, UTF-8 locale).
  - Consider raising `ulimit -n` for many WS clients.
- macOS (developer machines):
  - Same behavior expected; verify Homebrew `tmux`, `node`, and permissions for logs.
- General:
  - Ensure `logs/` is writable; rotate if disk logging is enabled.
  - Termination signals (SIGTERM) should shut down PTYs cleanly and close logs.

---

## References (Code Locations)
- UI WebSocket: `hooks/useWebSocket.ts`
- Terminal rendering: `components/TerminalView.tsx`, `hooks/useTerminal.ts`
- REST endpoints (tmux): `app/api/sessions/*`, `lib/tmux.ts`
- Legacy WS server (to retire): `server.mjs`

---

This checklist is intended to be actionable end-to-end. Ticking all boxes should yield a measurably more reliable and scalable AI Maestro, with smoother output handling, consistent reconnects, safer multi-viewer behavior, and better operator visibility.

---

## Mobile Support Addendum

Mobile browsers (iOS Safari, Android Chrome) impose additional constraints: dynamic toolbars affecting viewport height, virtual keyboards that do not resize layout consistently, touch gesture conflicts, and stricter power/network policies in background. This addendum outlines targeted improvements for mobile reliability and UX.

1) Viewport & Virtual Keyboard
- [ ] Replace `100vh` with dynamic viewport units: use `100dvh` for containers that must fill the screen.
- [ ] Terminal host container CSS:
  - [ ] `height: 100dvh;`
  - [ ] `overscroll-behavior: contain;` (prevents page bounce/scroll chaining)
  - [ ] `touch-action: pan-y;` (allow vertical panning only)
  - [ ] `padding-bottom: env(safe-area-inset-bottom);` (respect iOS home indicator)
- [ ] VisualViewport handling (iOS):
  - [ ] Listen to `window.visualViewport.resize` and adjust terminal host height to `visualViewport.height` when the virtual keyboard is visible.
  - [ ] Debounce updates (e.g., 50–100ms) and refit terminal once settled.
- [ ] On focus of prompt/textarea, ensure the terminal remains visible (scroll into view where needed).

Acceptance criteria
- [ ] With keyboard open on iOS Safari and Android Chrome, terminal/prompt remain fully visible without content jump.
- [ ] Orientation changes trigger a refit and maintain correct rows/cols.

2) Touch Gestures & Scrolling
- [ ] Single-finger vertical drag scrolls terminal buffer smoothly.
- [ ] Prevent the page from scrolling when terminal can scroll (use `overscroll-behavior`, `touch-action`, and event handling where needed).
- [ ] Optional: support two-finger scroll for nested scroll contexts if helpful; otherwise, prefer predictable single-finger behavior.
- [ ] Use passive listeners for touch/wheel events where appropriate to improve responsiveness.

Acceptance criteria
- [ ] No accidental page scrolling while interacting with the terminal.
- [ ] Inertial scrolling feels native; selection is not inadvertently cleared while scrolling.

3) Clipboard & Selection
- [ ] Long-press selects text in the terminal; show a dedicated Copy button on mobile.
- [ ] Implement `navigator.clipboard.writeText` with fallback for iOS (execCommand or selection-based copy).
- [ ] Preserve bracketed paste behavior for multi-line prompts; ensure carriage return handling remains correct.

Acceptance criteria
- [ ] Long-press + Copy reliably places selected text on clipboard across iOS/Android.
- [ ] Multi-line paste inserts as a single bracketed block; Enter sends as expected.

4) Rendering & Performance (Mobile-Specific)
- [ ] Enable WebGL renderer; gracefully fall back to canvas if unavailable.
- [ ] Increase write-batching window slightly on mobile (e.g., 16–33ms) for smoother rendering under heavy output.
- [ ] Consider a smaller default font size on mobile (e.g., 13–14px) to maximize columns while preserving legibility.
- [ ] Optionally reduce xterm scrollback on mobile (e.g., 20k lines) to contain memory usage.

Acceptance criteria
- [ ] High-output workloads remain smooth on mid-tier mobile devices without UI stalls.

5) Connection Resilience on Mobile
- [ ] Show a clear offline/reconnecting indicator; pause non-critical UI updates during reconnect.
- [ ] Ensure heartbeats handle suspended tabs (mobile OS may throttle timers/background sockets); extend grace periods on mobile as needed.
- [ ] Resume cleanly on foregrounding; perform an immediate ack flush and refit.

Acceptance criteria
- [ ] Putting the app in background and returning later seamlessly restores the session state.

6) PWA & Fullscreen (Optional)
- [ ] Provide a PWA manifest; allow installation for fullscreen usage.
- [ ] Use Screen Wake Lock API (where supported) to prevent the device from sleeping during long sessions.

Acceptance criteria
- [ ] Installed PWA runs fullscreen with stable viewport; device sleep does not interrupt critical long-running tasks when wake lock is available.

7) QA Matrix
- [ ] Test devices/browsers:
  - [ ] iOS Safari (latest 2 major versions) on iPhone and iPad (portrait/landscape)
  - [ ] Android Chrome (latest 2 major versions) on at least one mid-tier device
- [ ] Scenarios:
  - [ ] Open keyboard, type/paste, send multi-line prompts
  - [ ] Long-press select and copy
  - [ ] Orientation change; split screen where applicable
  - [ ] Background the app for 5–10 minutes; return and verify reconnect + history
  - [ ] High-output test and scroll performance

---

Tip: many of these items require only UI/CSS adjustments and client event handling; they complement the core architectural changes (gateway, protocol, ring buffer) to deliver a first-class mobile experience.
