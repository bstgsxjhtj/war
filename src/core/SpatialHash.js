const DEFAULT_CELL_SIZE = 10;
const NEAREST_MAX_RINGS = 24;

export class SpatialHash {
  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    this._cells = new Map();
    this._result = [];
  }

  clear() { this._cells.clear(); }

  _key(x, z) {
    return Math.floor(x / this.cellSize) + ',' + Math.floor(z / this.cellSize);
  }

  insert(item) {
    const k = this._key(item.position.x, item.position.z);
    let bucket = this._cells.get(k);
    if (!bucket) { bucket = []; this._cells.set(k, bucket); }
    bucket.push(item);
  }

  queryRadius(pos, radius) {
    this._result.length = 0;
    const cs = this.cellSize;
    const minCx = Math.floor((pos.x - radius) / cs);
    const maxCx = Math.floor((pos.x + radius) / cs);
    const minCz = Math.floor((pos.z - radius) / cs);
    const maxCz = Math.floor((pos.z + radius) / cs);
    const py = pos.y ?? 0;
    const r2 = radius * radius;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this._cells.get(cx + ',' + cz);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          const dx = item.position.x - pos.x;
          const dy = (item.position.y ?? 0) - py;
          const dz = item.position.z - pos.z;
          const capR = item.capsule?.radius ?? 0;
          const eff = radius + capR;
          if (dx * dx + dy * dy + dz * dz <= eff * eff) this._result.push(item);
        }
      }
    }
    return this._result;
  }

  queryNearest(pos, filterFn) {
    if (this._cells.size === 0) return null;
    const cs = this.cellSize;
    const pcx = Math.floor(pos.x / cs);
    const pcz = Math.floor(pos.z / cs);
    const py = pos.y ?? 0;
    let best = null;
    let bestDistSq = Infinity;
    const checkCell = (cx, cz) => {
      const bucket = this._cells.get(cx + ',' + cz);
      if (!bucket) return;
      for (let i = 0; i < bucket.length; i++) {
        const item = bucket[i];
        if (filterFn && !filterFn(item)) continue;
        const dx = item.position.x - pos.x;
        const dy = (item.position.y ?? 0) - py;
        const dz = item.position.z - pos.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) { bestDistSq = dSq; best = item; }
      }
    };
    for (let ring = 0; ring <= NEAREST_MAX_RINGS; ring++) {
      if (ring === 0) {
        checkCell(pcx, pcz);
      } else {
        for (let cx = pcx - ring; cx <= pcx + ring; cx++) {
          checkCell(cx, pcz - ring);
          checkCell(cx, pcz + ring);
        }
        for (let cz = pcz - ring + 1; cz <= pcz + ring - 1; cz++) {
          checkCell(pcx - ring, cz);
          checkCell(pcx + ring, cz);
        }
      }
      if (best && bestDistSq <= (ring * cs) * (ring * cs)) break;
    }
    return best;
  }
}
