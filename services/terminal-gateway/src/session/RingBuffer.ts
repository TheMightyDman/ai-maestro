import { Buffer } from 'node:buffer'

export interface RingSnapshot {
  readonly data: Buffer
  readonly byteLength: number
}

export class RingBuffer {
  private readonly capacity: number
  private readonly storage: Buffer
  private start = 0
  private length = 0

  constructor(capacity: number) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer (received ${capacity})`)
    }

    this.capacity = Math.floor(capacity)
    this.storage = Buffer.allocUnsafe(this.capacity)
  }

  append(chunk: Buffer): void {
    if (chunk.length === 0) {
      return
    }

    if (chunk.length >= this.capacity) {
      // Keep only the most recent bytes that fit in the ring.
      chunk.copy(this.storage, 0, chunk.length - this.capacity)
      this.start = 0
      this.length = this.capacity
      return
    }

    // Ensure we have enough contiguous space by discarding the oldest data.
    while (this.length + chunk.length > this.capacity) {
      const overflow = this.length + chunk.length - this.capacity
      this.start = (this.start + overflow) % this.capacity
      this.length -= overflow
    }

    const end = (this.start + this.length) % this.capacity
    const firstCopy = Math.min(chunk.length, this.capacity - end)
    chunk.copy(this.storage, end, 0, firstCopy)

    const remaining = chunk.length - firstCopy
    if (remaining > 0) {
      chunk.copy(this.storage, 0, firstCopy, chunk.length)
    }

    this.length += chunk.length
  }

  snapshot(): RingSnapshot {
    if (this.length === 0) {
      return { data: Buffer.alloc(0), byteLength: 0 }
    }

    const result = Buffer.allocUnsafe(this.length)
    const firstCopy = Math.min(this.length, this.capacity - this.start)
    this.storage.copy(result, 0, this.start, this.start + firstCopy)

    if (firstCopy < this.length) {
      const remaining = this.length - firstCopy
      this.storage.copy(result, firstCopy, 0, remaining)
    }

    return { data: result, byteLength: this.length }
  }

  clear(): void {
    this.start = 0
    this.length = 0
  }

  size(): number {
    return this.capacity
  }

  byteLength(): number {
    return this.length
  }
}
