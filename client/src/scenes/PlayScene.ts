import Phaser from "phaser";
import { PlayerController, type InputType } from "../game/PlayerController";
import { getRowY, CEILING_Y, FLOOR_Y, PLATFORM_ROW_COUNT, GAME_WIDTH } from "../game/constants";
import type { MapData } from "../game/types";

/**
 * Static in-memory test level for verifying core movement in isolation,
 * ahead of the real level-loader ticket. Deliberately exercises every row,
 * a multi-row ladder, and platform edges.
 */
const TEST_MAP: MapData = {
  stageLevel: 0,
  startPos: { x: 80, y: FLOOR_Y },
  platforms: [
    { y: getRowY(3), startX: 20, endX: 980 },
    { y: getRowY(2), startX: 150, endX: 500 },
    { y: getRowY(2), startX: 600, endX: 980 },
    { y: getRowY(1), startX: 20, endX: 350 },
    { y: getRowY(1), startX: 650, endX: 980 },
    { y: getRowY(0), startX: 20, endX: 980 },
  ],
  ladders: [
    { x: 250, floor: 3 },
    { x: 250, floor: 2 },
    { x: 250, floor: 1 },
    { x: 250, floor: 0 },
  ],
  spikes: [],
  items: [],
  enemies: [],
};

export class PlayScene extends Phaser.Scene {
  private player = new PlayerController();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private playerSprite!: Phaser.GameObjects.Sprite;

  constructor() {
    super("PlayScene");
  }

  preload(): void {
    this.load.image("character", "/assets/sprites/character.png");
    this.load.image("ladder", "/assets/sprites/ladder.png");
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.drawStaticGeometry();

    this.player.reset(TEST_MAP.startPos, PLATFORM_ROW_COUNT); // start on the floor row
    this.playerSprite = this.add.sprite(this.player.x, this.player.getRenderY(), "character");
    this.playerSprite.setOrigin(0.5, 1); // feet-anchored, matching the original's Y-is-feet convention
  }

  private drawStaticGeometry(): void {
    const g = this.add.graphics();

    // Ceiling & floor (solid bars in the original; we mirror that with flat rects)
    g.fillStyle(0x333333, 1);
    g.fillRect(0, CEILING_Y - 4, GAME_WIDTH, 8);
    g.fillRect(0, FLOOR_Y - 4, GAME_WIDTH, 8);

    // Platforms
    g.fillStyle(0x5599ff, 1);
    for (const platform of TEST_MAP.platforms) {
      g.fillRect(platform.startX, platform.y - 4, platform.endX - platform.startX, 8);
    }

    // Ladders — rendered with the real sprite, stretched between the two rows it connects
    for (const ladder of TEST_MAP.ladders) {
      const topY = getRowY(ladder.floor);
      const bottomY = getRowY(ladder.floor + 1);
      const img = this.add.image(ladder.x, (topY + bottomY) / 2, "ladder");
      img.setDisplaySize(30, bottomY - topY);
    }
  }

  update(_time: number, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    const input = this.readInput();
    if (input !== "None") this.player.applyInput(input, TEST_MAP);
    this.player.update(deltaSeconds, TEST_MAP);

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
