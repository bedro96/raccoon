import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";
import { BootScene } from "./scenes/BootScene";
import { PlayScene } from "./scenes/PlayScene";
import { LevelScene } from "./scenes/LevelScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "app",
  backgroundColor: "#000000",
  scene: [BootScene, PlayScene, LevelScene],
};

new Phaser.Game(config);
