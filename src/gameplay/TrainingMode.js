// 训练场模式：假人靶（不攻击，高血），无胜负，练习用
export class TrainingMode {
  constructor(bus) {
    this.bus = bus;
    this.name = '训练场';
  }

  spawnLayout() {
    return {
      blue: [{ x: 0, z: -12 }],
      red: [
        { x: 0, z: 6, ang: Math.PI, passive: true },
        { x: 5, z: 6, ang: Math.PI, passive: true },
        { x: -5, z: 6, ang: Math.PI, passive: true },
        { x: 0, z: 12, ang: Math.PI, passive: true }
      ]
    };
  }

  checkWin() { return null; }
}
