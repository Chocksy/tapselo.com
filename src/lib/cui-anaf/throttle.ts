import { ANAF_MIN_MS_BETWEEN_REQUESTS } from "./constants.ts";

/** Serializes ANAF calls to at most one request per second (per isolate / client). */
export class AnafRequestThrottle {
  private lastAt = 0;
  private chain: Promise<void> = Promise.resolve();
  private readonly minGapMs: number;

  constructor(minGapMs = ANAF_MIN_MS_BETWEEN_REQUESTS) {
    this.minGapMs = minGapMs;
  }

  /** Waits until a slot is available, then reserves it. */
  async acquire(now = Date.now()): Promise<void> {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const prev = this.chain;
    this.chain = gate;
    await prev;
    const wait = Math.max(0, this.minGapMs - (now - this.lastAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastAt = Date.now();
    release();
  }

  /** Seconds until the next slot (0 = now). */
  retryAfterSeconds(now = Date.now()): number {
    const elapsed = now - this.lastAt;
    if (elapsed >= this.minGapMs) return 0;
    return Math.ceil((this.minGapMs - elapsed) / 1000);
  }
}
