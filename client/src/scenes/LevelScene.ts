import Phaser from "phaser";
import { PlayerController, type InputType } from "../game/PlayerController";
import { getRowY, CEILING_Y, FLOOR_Y, PLATFORM_ROW_COUNT, GAME_WIDTH } from "../game/constants";
import { getEnemyPatrolX } from "../game/enemyPatrol";
import { loadMapData } from "../game/mapLoader";
import {
  buildRespawnBlinkSequence,
  RESPAWN_BLINK_COUNT,
  RESPAWN_BLINK_INTERVAL_MS,
  getRespawnBlinkDuration,
} from "../game/respawnBlink";
import { getEnemyTextureKey, getItemRenderConfig } from "../game/spriteSelection";
import type { ItemData, MapData } from "../game/types";

/**
/**
 * Campaign level order: the original two shipped levels, followed by two new
 * custom levels. stage.map/level1.map/level2.map remain confirmed unused
 * editor artifacts.
 */
const LEVEL_URLS = [
  "/assets/levels/stage1.map",
  "/assets/levels/stage2.map",
  "/assets/levels/stage3.map",
  "/assets/levels/stage4.map",
];

// Display sizes (px). Original size for these was 24x24; enemy and CARROT
// (item1) are rendered 50% larger per explicit request for visibility.
// CHERRY (item2) is left at its original size. BANANA gets the same 36px
// treatment as CARROT so the wider crescent silhouette still reads clearly
// without crowding the 120px row spacing.
const ENEMY_DISPLAY_SIZE = 36;
const CARROT_DISPLAY_SIZE = 36;
const CHERRY_DISPLAY_SIZE = 24;
const BANANA_DISPLAY_SIZE = 36;

/**
 * Full playable level scene: loads a real level, renders it, and drives the
 * complete original gameplay loop -- movement, item pickup, spike/enemy
 * hazards (respawn on contact), and level-advance once every item on the
 * current level is collected. Ported from CUISingleGame::OnUpdate's
 * `if (m_MapData.Items.empty()) { ... }` check.
 *
 * The original ends a 2-level playthrough by returning to a lobby; per the
 * map's "no menu/title screen" decision, there is no lobby here, so
 * finishing the last level shows a brief completion message instead.
 */
export class LevelScene extends Phaser.Scene {
  private player = new PlayerController();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private levelIndex = 0;
  private currentMap: MapData | null = null;
  private geometryLayer?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private itemSprites = new Map<ItemData, Phaser.GameObjects.Image>();
  private enemySprites = new Map<MapData["enemies"][number], Phaser.GameObjects.Image>();
  private gameComplete = false;
  private completionText?: Phaser.GameObjects.Text;
  private restartButton?: Phaser.GameObjects.Text;
  private levelElapsedSeconds = 0;
  private respawnBlinkTimers: Phaser.Time.TimerEvent[] = [];
  /**
   * Guards against a stale in-flight loadLevel() (e.g. the auto-advance to
   * Level 2) resolving *after* a newer one (e.g. a Restart back to Level 1)
   * and clobbering the scene state it already settled. Each call captures
   * its own token and only applies its result if it's still the latest.
   */
  private loadGeneration = 0;

  constructor() {
    super("LevelScene");
  }

  preload(): void {
    this.load.image("character", "/assets/sprites/character.png");
    this.load.image("ladder", "/assets/sprites/ladder.png");
    this.load.image("item1", "/assets/sprites/item1.png");
    this.load.image("item2", "/assets/sprites/item2.png");
    this.load.image("item3", "/assets/sprites/banana.png");
    this.load.image("spike", "/assets/sprites/spike.png");
    this.load.image("enemy", "/assets/sprites/enemy.png");
    this.load.image("wolf", "/assets/sprites/wolf.png");
  }

  private getEnemyTextureKey(): "enemy" | "wolf" {
    return getEnemyTextureKey(this.levelIndex);
  }

  private getItemRenderConfig(item: ItemData): { key: "item1" | "item2" | "item3"; size: number } {
    return getItemRenderConfig(item, {
      carrot: CARROT_DISPLAY_SIZE,
      cherry: CHERRY_DISPLAY_SIZE,
      banana: BANANA_DISPLAY_SIZE,
    });
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.loadingText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Loading level…", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.scoreText = this.add.text(16, 16, "Score: 0", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
    });

    this.player.onItemPickup = (item) => {
      this.itemSprites.get(item)?.destroy();
      this.itemSprites.delete(item);
      this.scoreText?.setText(`Score: ${this.player.score}`);
    };
    this.player.onHazardHit = () => {
      this.blinkRespawn();
    };

    this.createRestartButton();

    void this.loadLevel(this.levelIndex);
  }

  private createRestartButton(): void {
    this.restartButton = this.add
      .text(this.scale.width - 16, 16, "Restart", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0) // anchor top-right, so it stays pinned to the corner
      .setDepth(1000) // always render above level geometry/sprites
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.restartButton?.setBackgroundColor("#555555"))
      .on("pointerout", () => this.restartButton?.setBackgroundColor("#333333"))
      .on("pointerdown", () => this.restartGame());
  }

  /** Resets the game back to the start of Level 1 -- score, items, and player state all cleared. */
  private restartGame(): void {
    this.gameComplete = false;
    this.completionText?.destroy();
    this.completionText = undefined;
    this.clearRespawnBlink();
    this.levelIndex = 0;
    this.currentMap = null; // pause updates while Level 1 reloads
    void this.loadLevel(this.levelIndex);
  }

  private async loadLevel(index: number): Promise<void> {
    const generation = ++this.loadGeneration;
    const map = await loadMapData(LEVEL_URLS[index]);

    // A newer loadLevel() call (e.g. Restart) started after this one -- discard
    // this stale result instead of clobbering state the newer call already settled.
    if (generation !== this.loadGeneration) return;

    this.currentMap = map;
    this.levelElapsedSeconds = 0;
    for (const enemy of map.enemies) {
      enemy.currentX = enemy.x;
      enemy.currentY = enemy.y;
    }

    this.loadingText?.destroy();
    this.loadingText = undefined;
    this.clearRespawnBlink();
    this.geometryLayer?.destroy();
    this.itemSprites.clear();
    this.enemySprites.clear();
    this.geometryLayer = this.drawGeometry(map);

    this.player.reset(map.startPos, PLATFORM_ROW_COUNT);
    this.scoreText?.setText(`Score: ${this.player.score}`);
    if (!this.playerSprite) {
      this.playerSprite = this.add.sprite(this.player.x, this.player.getRenderY(), "character");
      this.playerSprite.setOrigin(0.5, 1);
    } else {
      this.playerSprite.setPosition(this.player.x, this.player.getRenderY());
      this.playerSprite.setVisible(true);
    }
    this.playerSprite.setRotation(this.player.jumpRotation);
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

    const enemyTextureKey = this.getEnemyTextureKey();

    for (const item of map.items) {
      const { key, size } = this.getItemRenderConfig(item);
      const img = this.add.image(item.x, item.y - size / 2, key);
      img.setDisplaySize(size, size);
      container.add(img);
      this.itemSprites.set(item, img);
    }

    for (const enemy of map.enemies) {
      const img = this.add.image(
        enemy.currentX ?? enemy.x,
        (enemy.currentY ?? enemy.y) - ENEMY_DISPLAY_SIZE / 2,
        enemyTextureKey,
      );
      img.setDisplaySize(ENEMY_DISPLAY_SIZE, ENEMY_DISPLAY_SIZE);
      container.add(img);
      this.enemySprites.set(enemy, img);
    }

    return container;
  }

  private clearRespawnBlink(): void {
    if (this.respawnBlinkTimers.length > 0) {
      this.time.removeEvent(this.respawnBlinkTimers);
      this.respawnBlinkTimers = [];
    }
    this.playerSprite?.setVisible(true);
  }

  private blinkRespawn(): void {
    if (!this.playerSprite) return;

    this.clearRespawnBlink();

    const steps = buildRespawnBlinkSequence(RESPAWN_BLINK_COUNT, RESPAWN_BLINK_INTERVAL_MS);
    const timers = steps.map((step) =>
      this.time.delayedCall(step.delayMs, () => {
        this.playerSprite?.setVisible(step.visible);
      }),
    );

    timers.push(
      this.time.delayedCall(getRespawnBlinkDuration(RESPAWN_BLINK_COUNT, RESPAWN_BLINK_INTERVAL_MS), () => {
        this.player.respawn();
        this.playerSprite?.setPosition(this.player.x, this.player.getRenderY());
        this.playerSprite?.setVisible(true);
        this.respawnBlinkTimers = [];
      }),
    );

    this.respawnBlinkTimers = timers;
  }

  private showGameComplete(): void {
    this.gameComplete = true;
    this.clearRespawnBlink();
    this.playerSprite?.setVisible(false);
    this.completionText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, `GAME COMPLETE\nFinal score: ${this.player.score}`, {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);
  }

  private updateEnemies(map: MapData): void {
    const enemyTextureKey = this.getEnemyTextureKey();
    for (const enemy of map.enemies) {
      enemy.currentX = getEnemyPatrolX(enemy.x, enemy.patrolRange, this.levelElapsedSeconds);
      enemy.currentY = enemy.y;
      this.enemySprites
        .get(enemy)
        ?.setTexture(enemyTextureKey)
        ?.setPosition(enemy.currentX, enemy.currentY - ENEMY_DISPLAY_SIZE / 2);
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.gameComplete || !this.currentMap) return; // still loading, or finished

    const deltaSeconds = deltaMs / 1000;
    this.levelElapsedSeconds += deltaSeconds;
    this.updateEnemies(this.currentMap);

    const input = this.readInput();
    if (input !== "None") this.player.applyInput(input, this.currentMap);
    this.player.update(deltaSeconds, this.currentMap);
    this.player.checkHazards(this.currentMap);

    this.playerSprite.setPosition(this.player.x, this.player.getRenderY());
    this.playerSprite.setRotation(this.player.jumpRotation);
    // The character sprite's native art faces left, so mirror it only when
    // facing/moving right (facingDir > 0) -- previously inverted, causing the
    // sprite to face backward while walking and during the jump arc.
    this.playerSprite.setFlipX(this.player.facingDir > 0);

    // Ported from CUISingleGame::OnUpdate: once every item on the current
    // level is collected, advance to the next level (or finish, on the last one).
    if (!this.player.isDead() && this.currentMap.items.length === 0) {
      if (this.levelIndex + 1 < LEVEL_URLS.length) {
        this.levelIndex += 1;
        this.currentMap = null; // pause updates while the next level loads
        void this.loadLevel(this.levelIndex);
      } else {
        this.showGameComplete();
      }
    }
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
