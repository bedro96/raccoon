import Phaser from "phaser";

/**
 * Brief boot scene — confirms the Phaser canvas boots correctly, then hands
 * off to gameplay. Per the map's decision there's no menu/title screen, so
 * this is just a minimal flash, not a UI the player lingers on.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Ponpoko", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.time.delayedCall(200, () => this.scene.start("PlayScene"));
  }
}
