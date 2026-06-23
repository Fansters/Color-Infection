import { Container, Graphics, Sprite, Texture } from "pixi.js";

export class GraphicsPool {
  private readonly pool: Graphics[] = [];

  constructor(private readonly parent: Container) {}

  sync<T>(items: readonly T[], update: (graphic: Graphics, item: T, index: number) => void) {
    while (this.pool.length < items.length) {
      const graphic = new Graphics();
      graphic.visible = false;
      this.parent.addChild(graphic);
      this.pool.push(graphic);
    }

    for (let index = 0; index < this.pool.length; index += 1) {
      const graphic = this.pool[index];
      const item = items[index];

      if (item === undefined) {
        graphic.visible = false;
        graphic.clear();
        continue;
      }

      graphic.visible = true;
      update(graphic, item, index);
    }
  }

  get activeCount() {
    return this.pool.filter((graphic) => graphic.visible).length;
  }

  get objectCount() {
    return this.pool.length;
  }

  destroy() {
    for (const graphic of this.pool) {
      graphic.destroy();
    }

    this.pool.length = 0;
  }
}

export class SpritePool {
  private readonly pool: Sprite[] = [];

  constructor(
    private readonly parent: Container,
    private readonly texture: Texture,
  ) {}

  sync<T>(items: readonly T[], update: (sprite: Sprite, item: T, index: number) => void) {
    while (this.pool.length < items.length) {
      const sprite = new Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.parent.addChild(sprite);
      this.pool.push(sprite);
    }

    for (let index = 0; index < this.pool.length; index += 1) {
      const sprite = this.pool[index];
      const item = items[index];

      if (item === undefined) {
        sprite.visible = false;
        continue;
      }

      sprite.visible = true;
      update(sprite, item, index);
    }
  }

  get activeCount() {
    return this.pool.filter((sprite) => sprite.visible).length;
  }

  get objectCount() {
    return this.pool.length;
  }

  destroy() {
    for (const sprite of this.pool) {
      sprite.destroy();
    }

    this.pool.length = 0;
  }
}
