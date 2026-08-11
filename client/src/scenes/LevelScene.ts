import Phaser from "phaser";
import { PlayerController, type InputType } from "../game/PlayerController";
import { getRowY, CEILING_Y, FLOOR_Y, PLATFORM_ROW_COUNT, GAME_WIDTH } from "../game/constants";
import { loadMapData } from "../game/mapLoader";
import type { MapData } from "../game/types";

/**
 * The two levels actually loaded by the original single-player game
 * (see the "Reverse-engineer..." ticket -- stage.map/level1.map/level2.map
 * are confirmed unused editor artifacts; only these two are real).
 */
const LEVEL_URLS = ["/assets/levels/stage1.map", "/assets/levels/stage2.map"];

/**
 * Renders a real, loaded level (platforms, ladders, and item/spike/enemy
 * placement) and lets the player move around it with the ported physics.
 * Item pickup, spike/enemy hazards, and level-advance behavior are NOT
 * implemented here -- that's "Implement enemies, spikes, items, and
 * level-advance win condition". This scene only proves the loader + core
 * movement integrate correctly against real level data.
 *
 * Press 'N' to manually cycle to the next level (a stand-in for the real
 * win-condition-triggered advance, which ticket #29 implements).
 */
export class LevelScene extends Phaser.Scene {
  private player = new PlayerController();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private nextLevelKey!: Phaser.Input.Keyboard.Key;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private levelIndex = 0;
  private currentMap: MapData | null = null;
  private geometryLayer?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;

  constructor() {
    super("LevelScene");
  }

  preload(): void {
    this.load.image("character", "/assets/sprites/character.png");
    this.load.image("ladder", "/assets/sprites/ladder.png");
    this.load.image("item1", "/assets/sprites/item1.png");
    this.load.image("item2", "/assets/sprites/item2.png");
    this.load.image("spike", "/assets/sprites/spike.png");
    this.load.image("enemy", "/assets/sprites/enemy.png");
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.nextLevelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);

    this.loadingText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Loading level…", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    void this.loadLevel(this.levelIndex);
  }

  private async loadLevel(index: number): Promise<void> {
    const map = await loadMapData(LEVEL_URLS[index]);
    this.currentMap = map;

    this.loadingText?.destroy();
    this.geometryLayer?.destroy();
    this.geometryLayer = this.drawGeometry(map);

    this.player.reset(map.startPos, PLATFORM_ROW_COUNT);
    if (!this.playerSprite) {
      this.playerSprite = this.add.sprite(this.player.x, this.player.getRenderY(), "character");
      this.playerSprite.setOrigin(0.5, 1);
    } else {
      this.playerSprite.setPosition(this.player.x, this.player.getRenderY());
    }
  }

  private drawGeometry(map: MapData): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    container.add(g);

    g.fillStyle(0x333333, 1);
    g.fillRect(0, CEILING_Y - 4, GAME_WIDTH, 8);
    g.fillRect(0, FLOOR_Y - 4, GAME_WIDTH, 8);

    g.fillStyle(0x5599ff, 1);
    for (const platform of map.platforms) {
      g.fillRect(platform.startX, platform.y - 4, platform.endX - platform.startX, 8);
    }

    for (const ladder of map.ladders) {
      const topY = getRowY(ladder.floor);
      const bottomY = getRowY(ladder.floor + 1);
      const img = this.add.image(ladder.x, (topY + bottomY) / 2, "ladder");
      img.setDisplaySize(30, bottomY - topY);
      container.add(img);
    }

    for (const spike of map.spikes) {
      const img = this.add.image(spike.x, spike.y - 12, "spike");
      img.setDisplaySize(20, 24);
      container.add(img);
    }

    for (const item of map.items) {
      const key = item.type === "CARROT" ? "item1" : "item2";
      const img = this.add.image(item.x, item.y - 12, key);
      img.setDisplaySize(24, 24);
      container.add(img);
    }

    for (const enemy of map.enemies) {
      const img = this.add.image(enemy.x, enemy.y - 12, "enemy");
      img.setDisplaySize(24, 24);
      container.add(img);
    }

    return container;
  }

  update(_time: number, deltaMs: number): void {
    if (!this.currentMap) return; // still loading

    if (Phaser.Input.Keyboard.JustDown(this.nextLevelKey)) {
      this.levelIndex = (this.levelIndex + 1) % LEVEL_URLS.length;
      void this.loadLevel(this.levelIndex);
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const input = this.readInput();
    if (input !== "None") this.player.applyInput(input, this.currentMap);
    this.player.update(deltaSeconds, this.currentMap);

    this.playerSprite.setPosition(this.player.x, this.player.getRenderY());
    this.playerSprite.setFlipX(this.player.facingDir < 0);
  }

  private readInput(): InputType {
    if (this.spaceKey.isDown) return "Jump";
    if (this.cursors.up.isDown) return "ClimbUp";
    if (this.cursors.down.isDown) return "ClimbDown";
    if (this.cursors.left.isDown) return "MoveLeft";
    if (this.cursors.right.isDown) return "MoveRight";
    return "None";
  }
}
