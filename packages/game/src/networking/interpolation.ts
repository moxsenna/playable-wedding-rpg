// Snapshot interpolation (§11-12): rolling buffer per remote, render target
// at estimatedServerNow - delay, lerp between bracketing snapshots, short
// bounded extrapolation, then settle. Pure math, no Phaser.
export interface TransformSnapshot {
  serverTs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const INTERP_DELAY_MS = 120;
const BUFFER_SIZE = 12;
const EXTRAPOLATE_MS = 250;

export class SnapshotBuffer {
  private snaps: TransformSnapshot[] = [];

  push(s: TransformSnapshot): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.serverTs <= last.serverTs) return;
    this.snaps.push(s);
    if (this.snaps.length > BUFFER_SIZE) this.snaps.shift();
  }

  sample(renderTime: number): { x: number; y: number; settled: boolean } {
    const n = this.snaps.length;
    if (n === 0) return { x: 0, y: 0, settled: true };
    if (n === 1 || renderTime <= this.snaps[0].serverTs) {
      const s = renderTime <= this.snaps[0].serverTs ? this.snaps[0] : this.snaps[n - 1];
      return { x: s.x, y: s.y, settled: n === 1 };
    }
    for (let i = 0; i < n - 1; i++) {
      const a = this.snaps[i];
      const b = this.snaps[i + 1];
      if (renderTime >= a.serverTs && renderTime <= b.serverTs) {
        const span = b.serverTs - a.serverTs;
        const t = span > 0 ? (renderTime - a.serverTs) / span : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, settled: false };
      }
    }
    const last = this.snaps[n - 1];
    const over = renderTime - last.serverTs;
    if (over <= EXTRAPOLATE_MS) {
      return {
        x: last.x + last.vx * (over / 1000),
        y: last.y + last.vy * (over / 1000),
        settled: false,
      };
    }
    return { x: last.x, y: last.y, settled: true };
  }
}
