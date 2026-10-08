import type Phaser from 'phaser';

const LIGHT = 'vfx-soft-light';
/** One continuous radial texture per game, shared by bounded sprite pools. */
export class NaturalEffects {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  aspect = 1;
  constructor(private scene: Phaser.Scene, private depth: number, private limit = 96, private parent?: Phaser.GameObjects.Container) {
    if (!scene.textures.exists(LIGHT)) {
      const texture = scene.textures.createCanvas(LIGHT, 128, 128)!;
      const context = texture.getContext(), gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(.18, 'rgba(255,255,255,.65)');
      gradient.addColorStop(.5, 'rgba(255,255,255,.16)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); texture.refresh();
    }
  }
  begin() { this.used = 0; this.aspect = this.scene.cameras.main.zoomX / this.scene.cameras.main.zoomY; }
  draw(key: string, frame: number | undefined, x: number, y: number, size: number, alpha: number, angle = 0, tint = 0xffffff, width = size) {
    if (alpha <= .002 || size <= 0 || this.used >= this.limit) return;
    let image = this.sprites[this.used++];
    if (!image) {
      image = this.scene.add.image(x, y, key, frame).setDepth(this.depth); this.sprites.push(image);
      if (this.parent) this.parent.addAt(image, 1);
    }
    image.setTexture(key, frame).setVisible(true).setPosition(x, y).setDisplaySize(width, size * this.aspect)
      .setAlpha(Math.min(1, alpha)).setAngle(angle).setTint(tint);
  }
  glow(x: number, y: number, size: number, color: number, alpha: number) { this.draw(LIGHT, undefined, x, y, size, alpha, 0, color); }
  end() { for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].setVisible(false); }
  get active() { return this.used; }
  get allocated() { return this.sprites.length; }
}
/** Stable visual variation, independent of gameplay RNG and replay state. */
export const variation = (seed: number, salt: number) => {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};
