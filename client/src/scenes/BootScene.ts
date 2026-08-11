import Phaser from "phaser";

/**
 * Placeholder boot scene — confirms the Phaser canvas boots correctly.
 * Real gameplay scenes are added by later tickets (player movement, level loader, etc.).
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

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 48, "client scaffold booted", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#888888",
      })
      .setOrigin(0.5);
  }
}
