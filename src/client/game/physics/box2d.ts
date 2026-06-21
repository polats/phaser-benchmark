// The npm package's `main` points at a non-existent index.js, so we import the
// prebuilt ESM bundle directly. It ships no TypeScript types (see the ambient
// `declare module` in phaser-box2d.d.ts), hence the typed facade below.
import * as Box2DLib from 'phaser-box2d/dist/PhaserBox2D.js';
import type { GameObjects } from 'phaser';

// phaser-box2d ships generated JSDoc types that don't match its documented
// runtime helper API (e.g. WorldStep is typed `{ worldDef }` but called with
// `{ worldId, deltaTime }`, and SpriteToBox marks `size` required even though it
// reads the size from the sprite). Rather than scatter casts at every call site,
// we declare the small, correctly-typed subset we actually use, once, here.
//
// Reference: phaser-box2d getting-started "A Quick Phaser Sprite Example".

type Vec2 = { x: number; y: number };
type WorldId = unknown;
type BodyHandle = { bodyId: unknown; shapeId: unknown; object: unknown };

type Box2DApi = {
  STATIC: number;
  DYNAMIC: number;
  SetWorldScale(scale: number): void;
  pxmVec2(xPixels: number, yPixels: number): Vec2;
  b2Vec2: new (x: number, y: number) => Vec2;
  b2DefaultWorldDef(): { gravity: Vec2 };
  CreateWorld(data: { worldDef: unknown }): { worldId: WorldId };
  WorldStep(data: { worldId: WorldId; deltaTime: number }): number;
  CreateBoxPolygon(data: {
    worldId: WorldId;
    type: number;
    position: Vec2;
    size: Vec2 | number;
    friction?: number;
    density?: number;
  }): BodyHandle;
  SpriteToBox(
    worldId: WorldId,
    sprite: GameObjects.Sprite,
    data: { type: number; friction?: number; restitution?: number; density?: number }
  ): BodyHandle;
  AddSpriteToWorld(worldId: WorldId, sprite: GameObjects.Sprite, body: BodyHandle): void;
  RemoveSpriteFromWorld(worldId: WorldId, sprite: GameObjects.Sprite, destroyBody?: boolean): void;
  UpdateWorldSprites(worldId: WorldId): void;
  b2Body_SetTransform(bodyId: unknown, position: Vec2, rotation: unknown): void;
  b2Body_SetLinearVelocity(bodyId: unknown, velocity: Vec2): void;
  b2Body_SetAwake(bodyId: unknown, awake: boolean): void;
  b2Body_GetRotation(bodyId: unknown): unknown;
};

const B2 = Box2DLib as unknown as Box2DApi;

/** Pixels-per-meter scale. Box2D works in meters; this maps it to screen pixels. */
export const WORLD_SCALE = 40;

export function initWorldScale() {
  B2.SetWorldScale(WORLD_SCALE);
}

export function createWorld(gravityY: number): WorldId {
  const def = B2.b2DefaultWorldDef();
  def.gravity = new B2.b2Vec2(0, gravityY);
  return B2.CreateWorld({ worldDef: def }).worldId;
}

// Box2D is a fixed-timestep simulation: feeding it the real (variable) frame
// delta makes fast bodies tunnel through thin static shapes when the frame rate
// drops. We always step a fixed 1/60s. If the device can't keep 60fps the sim
// runs in slow-motion, but it stays stable and bodies never fall through.
const FIXED_STEP = 1 / 60;

export function stepWorld(worldId: WorldId) {
  B2.WorldStep({ worldId, deltaTime: FIXED_STEP });
}

/** Create a static box wall at a pixel position/size. */
export function createStaticBox(
  worldId: WorldId,
  xPixels: number,
  yPixels: number,
  halfWidthMeters: number,
  halfHeightMeters: number
) {
  B2.CreateBoxPolygon({
    worldId,
    type: B2.STATIC,
    position: B2.pxmVec2(xPixels, yPixels),
    size: new B2.b2Vec2(halfWidthMeters, halfHeightMeters),
    friction: 0.5,
  });
}

/**
 * Turn a Phaser sprite into a STATIC body using the sprite's screen position and
 * display size. Using SpriteToBox (rather than CreateBoxPolygon + pxmVec2) means
 * static and dynamic bodies share the exact same pixel->meter conversion, so
 * floors/walls line up perfectly with the bodies that land on them.
 */
export function bindStaticSprite(worldId: WorldId, sprite: GameObjects.Sprite) {
  B2.SpriteToBox(worldId, sprite, { type: B2.STATIC, friction: 0.6 });
}

/** Turn an existing Phaser sprite into a dynamic, world-synced rigid body.
 *  Returns the body id so it can be dragged/forced later. */
export function bindDynamicSprite(worldId: WorldId, sprite: GameObjects.Sprite): unknown {
  const body = B2.SpriteToBox(worldId, sprite, {
    type: B2.DYNAMIC,
    restitution: 0.3,
    friction: 0.2,
    density: 1,
  });
  B2.AddSpriteToWorld(worldId, sprite, body);
  return body.bodyId;
}

/** Unbind a sprite from its body (optionally destroying the body). Used while
 *  dragging: we free the sprite so it follows the pointer, then re-create a body
 *  from the sprite's new position on release. This avoids any pixel<->meter
 *  conversion drift, because bodies are only ever created via SpriteToBox. */
export function removeSpriteFromWorld(worldId: WorldId, sprite: GameObjects.Sprite) {
  B2.RemoveSpriteFromWorld(worldId, sprite, true);
}

/** Set a body's linear velocity from a pixels/frame delta (used on release / fling). */
export function setBodyVelocity(bodyId: unknown, vxPixels: number, vyPixels: number) {
  B2.b2Body_SetLinearVelocity(bodyId, B2.pxmVec2(vxPixels, vyPixels));
}

/** Sync every bound sprite to its body. Call once per frame, after stepWorld. */
export function syncSprites(worldId: WorldId) {
  B2.UpdateWorldSprites(worldId);
}
