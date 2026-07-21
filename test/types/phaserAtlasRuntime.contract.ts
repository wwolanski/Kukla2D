import Phaser from 'phaser';

// Mirrors the loader calls emitted by buildExampleTs. Compilation against the
// exact phaser dependency guards method names, argument order and arity.
class SingleAtlasContractScene extends Phaser.Scene {
  preload(): void {
    this.load.atlas('hero', 'hero/hero.png', 'hero/hero.atlas.json');
    this.load.animation('hero-anims', 'hero/hero.animations.json');
  }
}

class MultiAtlasContractScene extends Phaser.Scene {
  preload(): void {
    this.load.multiatlas('hero', 'hero/hero.atlas.json', 'hero');
    this.load.animation('hero-anims', 'hero/hero.animations.json');
  }
}

void SingleAtlasContractScene;
void MultiAtlasContractScene;
