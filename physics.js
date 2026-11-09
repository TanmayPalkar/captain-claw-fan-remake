import { rectsOverlap } from './utils.js';

/**
 * Shared kinematic AABB movement. Handles solid platforms, one-way platforms,
 * and riding moving platforms without tunneling or wall-sticking.
 */
export function moveActor(actor, level, dt) {
  const solids = level.getCollisionSolids();
  const riding = actor.standingPlatform;

  if (riding && riding.active !== false) {
    actor.x += riding.dx || 0;
    actor.y += riding.dy || 0;
  }

  actor.x += actor.vx * dt;

  for (const solid of solids) {
    if (solid.oneWay || solid.active === false) continue;
    if (!rectsOverlap(actor, solid)) continue;

    if (actor.vx > 0) {
      actor.x = solid.x - actor.w;
    } else if (actor.vx < 0) {
      actor.x = solid.x + solid.w;
    } else {
      const actorCenter = actor.x + actor.w * 0.5;
      const solidCenter = solid.x + solid.w * 0.5;
      if (actorCenter < solidCenter) actor.x = solid.x - actor.w;
      else actor.x = solid.x + solid.w;
    }
    actor.vx = 0;
  }

  actor.onGround = false;
  actor.standingPlatform = null;
  const previousBottom = actor.y + actor.h;
  actor.y += actor.vy * dt;

  for (const solid of solids) {
    if (solid.active === false) continue;
    if (!rectsOverlap(actor, solid)) continue;

    if (solid.oneWay) {
      if (
        actor.vy >= 0 &&
        previousBottom <= solid.y + 8 &&
        actor.y + actor.h >= solid.y
      ) {
        actor.y = solid.y - actor.h;
        actor.vy = 0;
        actor.onGround = true;
        actor.standingPlatform = solid;
      }
      continue;
    }

    if (actor.vy > 0) {
      actor.y = solid.y - actor.h;
      actor.vy = 0;
      actor.onGround = true;
      actor.standingPlatform = solid;
    } else if (actor.vy < 0) {
      actor.y = solid.y + solid.h;
      actor.vy = 0;
    } else {
      const actorCenter = actor.y + actor.h * 0.5;
      const solidCenter = solid.y + solid.h * 0.5;
      if (actorCenter < solidCenter) {
        actor.y = solid.y - actor.h;
        actor.onGround = true;
        actor.standingPlatform = solid;
      } else {
        actor.y = solid.y + solid.h;
      }
    }
  }

  if (actor.onGround && actor.vy > 0) actor.vy = 0;
  return actor.onGround;
}

/** True when a small foot probe lands on a solid surface. */
export function hasFootingAt(level, x, footY) {
  const probe = { x: x - 3, y: footY - 2, w: 6, h: 7 };
  const solids = level.getCollisionSolids();
  for (const solid of solids) {
    if (solid.active === false || solid.oneWay) continue;
    if (rectsOverlap(probe, solid)) return true;
  }
  return false;
}

/** True when the actor is standing close enough to a ledge edge to walk off. */
export function hasGroundAhead(level, actor, direction, distance = 8) {
  const x = direction > 0 ? actor.x + actor.w + distance : actor.x - distance;
  return hasFootingAt(level, x, actor.y + actor.h + 2);
}

export function isTouchingSolid(level, x, y) {
  const solids = level.getCollisionSolids();
  for (const solid of solids) {
    if (solid.active === false) continue;
    if (x >= solid.x && x <= solid.x + solid.w && y >= solid.y && y <= solid.y + solid.h) {
      return solid;
    }
  }
  return null;
}
