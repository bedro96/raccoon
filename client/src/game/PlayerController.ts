import {
  CLIMB_DURATION,
  FALL_DURATION,
  FLOOR_LEFT_BOUND,
  FLOOR_RIGHT_BOUND,
  FLOOR_Y,
  JUMP_DISTANCE,
  JUMP_DURATION,
  JUMP_HEIGHT,
  LADDER_TOLERANCE,
  MOVE_STEP,
  PICKUP_RADIUS,
  PLATFORM_ROW_COUNT,
  getRowY,
} from "./constants";
import type { ItemData, MapData } from "./types";

export type InputType = "MoveLeft" | "MoveRight" | "ClimbUp" | "ClimbDown" | "Jump" | "None";

/**
 * Row-based player movement, ported 1:1 from the original CPlayerSession
 * (PlayerSession.h/.cpp). The player snaps between PLATFORM_ROW_COUNT
 * discrete horizontal rows; falling and ladder-climbing are timed linear
 * interpolations between rows rather than continuous gravity, and jumping
 * is a fixed-duration parabolic arc that does not change row.
 */
export class PlayerController {
  x = 0;
  row = 0;
  score = 0;
  facingDir = 1;

  jumping = false;
  private jumpTimer = 0;
  jumpOffsetY = 0;
  private jumpStartX = 0;

  rowTransition = false;
  private falling = false;
  private rowTransitionTimer = 0;
  private transitionFromRow = 0;
  private transitionToRow = 0;
  rowOffsetY = 0;

  private startX = 0;
  private startRow = 0;

  /** Fired when the player picks up an item (score already applied). */
  onItemPickup?: (item: ItemData) => void;
  /** Fired when the player is respawned after hitting a spike or enemy. */
  onHazardHit?: () => void;

  reset(startPos: { x: number; y: number }, startRow: number): void {
    this.startX = startPos.x;
    this.startRow = startRow;
    this.x = startPos.x;
    this.row = startRow;
    this.score = 0;
    this.facingDir = 1;
    this.jumping = false;
    this.jumpTimer = 0;
    this.jumpOffsetY = 0;
    this.rowTransition = false;
    this.falling = false;
    this.rowOffsetY = 0;
  }

  private tryGetPlatformBounds(map: MapData, atX: number): { startX: number; endX: number } | null {
    const rowY = getRowY(this.row);

    if (rowY === FLOOR_Y) {
      return { startX: FLOOR_LEFT_BOUND, endX: FLOOR_RIGHT_BOUND };
    }

    for (const platform of map.platforms) {
      if (platform.y === rowY && atX >= platform.startX && atX <= platform.endX) {
        return { startX: platform.startX, endX: platform.endX };
      }
    }
    return null;
  }

  private hasLadderAt(map: MapData, floor: number): boolean {
    return map.ladders.some((l) => l.floor === floor && Math.abs(l.x - this.x) <= LADDER_TOLERANCE);
  }

  private startRowTransition(toRow: number, falling: boolean): void {
    this.rowTransition = true;
    this.falling = falling;
    this.rowTransitionTimer = 0;
    this.transitionFromRow = this.row;
    this.transitionToRow = toRow;
  }

  private checkItemPickup(map: MapData): void {
    const rowY = getRowY(this.row);

    const itemIndex = map.items.findIndex((item) => item.y === rowY && Math.abs(item.x - this.x) <= PICKUP_RADIUS);
    if (itemIndex !== -1) {
      const [item] = map.items.splice(itemIndex, 1);
      this.score += item.score;
      this.onItemPickup?.(item);
    }
  }

  private checkHazardsInternal(map: MapData): void {
    const rowY = getRowY(this.row);

    for (const spike of map.spikes) {
      if (spike.y === rowY && Math.abs(spike.x - this.x) <= PICKUP_RADIUS) {
        this.respawn();
        this.onHazardHit?.();
        return;
      }
    }

    for (const enemy of map.enemies) {
      const enemyX = enemy.currentX ?? enemy.x;
      const enemyY = enemy.currentY ?? enemy.y;
      if (enemyY === rowY && Math.abs(enemyX - this.x) <= PICKUP_RADIUS) {
        this.respawn();
        this.onHazardHit?.();
        return;
      }
    }
  }

  private checkPickupAndHazards(map: MapData): void {
    this.checkItemPickup(map);
    this.checkHazardsInternal(map);
  }

  /** Re-check hazards against the player's current position, even if the player is idle. */
  checkHazards(map: MapData): void {
    if (this.jumping || this.rowTransition) return;
    this.checkHazardsInternal(map);
  }

  applyInput(input: InputType, map: MapData): void {
    if ((this.jumping || this.rowTransition) && input !== "None") return;

    switch (input) {
      case "MoveLeft":
      case "MoveRight": {
        const dir = input === "MoveLeft" ? -1 : 1;
        this.facingDir = dir;
        const bounds = this.tryGetPlatformBounds(map, this.x);
        if (!bounds) break;

        let nextX = this.x + dir * MOVE_STEP;
        if (nextX < bounds.startX) nextX = bounds.startX;
        if (nextX > bounds.endX) nextX = bounds.endX;
        this.x = nextX;
        break;
      }
      case "ClimbUp":
        if (this.row > 0 && this.hasLadderAt(map, this.row - 1)) {
          this.startRowTransition(this.row - 1, false);
        }
        break;
      case "ClimbDown":
        if (this.row < PLATFORM_ROW_COUNT && this.hasLadderAt(map, this.row)) {
          this.startRowTransition(this.row + 1, false);
        }
        break;
      case "Jump":
        this.jumping = true;
        this.jumpTimer = 0;
        this.jumpStartX = this.x;
        break;
      default:
        break;
    }

    if (input === "MoveLeft" || input === "MoveRight") {
      this.checkPickupAndHazards(map);
    }
  }

  update(deltaSeconds: number, map: MapData): void {
    if (this.rowTransition) {
      const duration = this.falling ? FALL_DURATION : CLIMB_DURATION;
      this.rowTransitionTimer += deltaSeconds;
      const t = this.rowTransitionTimer >= duration ? 1 : this.rowTransitionTimer / duration;

      const fromY = getRowY(this.transitionFromRow);
      const toY = getRowY(this.transitionToRow);
      this.rowOffsetY = (toY - fromY) * t;

      if (t >= 1) {
        this.row = this.transitionToRow;
        this.rowOffsetY = 0;
        this.rowTransition = false;

        if (this.falling && !this.tryGetPlatformBounds(map, this.x)) {
          this.startRowTransition(this.row + 1, true);
          return;
        }
        this.falling = false;
        this.checkPickupAndHazards(map);
      }
      return;
    }

    if (!this.jumping) return;

    this.jumpTimer += deltaSeconds;
    const t = this.jumpTimer >= JUMP_DURATION ? 1 : this.jumpTimer / JUMP_DURATION;

    this.x = this.jumpStartX + this.facingDir * JUMP_DISTANCE * t;
    if (this.x < FLOOR_LEFT_BOUND) this.x = FLOOR_LEFT_BOUND;
    if (this.x > FLOOR_RIGHT_BOUND) this.x = FLOOR_RIGHT_BOUND;

    if (this.jumpTimer >= JUMP_DURATION) {
      this.jumping = false;
      this.jumpOffsetY = 0;

      if (!this.tryGetPlatformBounds(map, this.x)) {
        this.startRowTransition(this.row + 1, true);
        return;
      }
      this.checkPickupAndHazards(map);
      return;
    }

    this.jumpOffsetY = 4 * JUMP_HEIGHT * t * (1 - t);
  }

  /** Current render Y: row Y plus any in-progress row-transition/jump offset. */
  getRenderY(): number {
    const baseY = getRowY(this.rowTransition ? this.transitionFromRow : this.row);
    return baseY + this.rowOffsetY - this.jumpOffsetY;
  }

  respawn(): void {
    this.x = this.startX;
    this.row = this.startRow;
    this.jumping = false;
    this.jumpOffsetY = 0;
    this.rowTransition = false;
    this.falling = false;
    this.rowOffsetY = 0;
  }
}
