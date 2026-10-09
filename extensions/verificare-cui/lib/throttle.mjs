import { ANAF_MIN_MS_BETWEEN_REQUESTS } from "./constants.mjs";

export class AnafRequestThrottle {
  constructor(minGapMs = ANAF_MIN_MS_BETWEEN_REQUESTS) {
    this.minGapMs = minGapMs;
    this.lastAt = 0;
    this.chain = Promise.resolve();
  }

  async acquire() {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const prev = this.chain;
    this.chain = gate;
    await prev;
    const now = Date.now();
    const wait = Math.max(0, this.minGapMs - (now - this.lastAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastAt = Date.now();
    release();
  }
}
