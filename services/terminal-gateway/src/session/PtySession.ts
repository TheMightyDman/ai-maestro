import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

export interface PtySessionOptions {
  readonly sessionName: string
  readonly cols?: number
  readonly rows?: number
  readonly cwd?: string
  readonly env?: NodeJS.ProcessEnv
  readonly onData: (chunk: Buffer) => void
  readonly onExit: (code: number | null, signal: number | null) => void
}

export class PtySession {
  private readonly pty: IPty
  private paused = false

  constructor(options: PtySessionOptions) {
    const {
      sessionName,
      cols = 80,
      rows = 24,
      cwd = process.env.HOME || process.cwd(),
      env = process.env,
      onData,
      onExit
    } = options

    const ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
      encoding: null
    })

    ptyProcess.onData((data) => {
      onData(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'))
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      onExit(exitCode ?? null, signal ?? null)
    })

    this.pty = ptyProcess
  }

  write(data: string | Buffer): void {
    if (Buffer.isBuffer(data)) {
      this.pty.write(data.toString('utf8'))
    } else {
      this.pty.write(data)
    }
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows)
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.pty.pause()
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.pty.resume()
  }

  dispose(): void {
    try {
      this.pty.kill()
    } catch {
      // ignore
    }
  }
}
