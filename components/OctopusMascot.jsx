"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import Lottie from "lottie-react";

import { useSession } from "@/hooks/useSession";
import { useAssistantChat } from "@/hooks/useAssistantChat";

// ---- Real octopus ink: near-black, not the old teal/purple ----
// A handful of very-close-to-black shades (not one flat value) so the
// goo-merged cloud has some depth instead of reading as a single flat
// silhouette. Slightly lighter/cooler than the page's own ink-950
// (#05070E) so it still registers as "darker than the background",
// not identical to it.
const INK_COLORS = ["#0B0B12", "#08080D", "#0E0E17", "#050508"];
// Sparse, very dim cool highlights mixed in with the black particles -
// like light catching the surface of wet ink - so the cloud doesn't
// vanish into the dark background. These use screen blending
// individually; the black particles use normal blending.
const INK_HIGHLIGHT_COLORS = ["#4FD8C4", "#8B7CF0"];
const INK_HIGHLIGHT_CHANCE = 0.25;

// Where the ink actually erupts from — the base of the mantle, right
// above the tentacles (measured pixel-by-pixel from the rendered
// artwork, not a guess). Fraction of the container size.
const INK_ORIGIN = { x: 0.437, y: 0.65 };

// How much empty space to keep clear at each viewport edge while
// wandering, so the mascot never gets clipped or sits under the
// bottom nav / toast stack.
const WANDER_MARGIN = { top: 70, bottom: 100, left: 16, right: 16 };
// On a phone the bottom strip belongs to real controls - the nav bar,
// and on the till the basket bar with the running total. Wandering into
// it means the mascot sits on the button somebody is trying to press.
const MOBILE_BOTTOM_MARGIN = 150;

// How far a finger has to travel before a press counts as "move the
// mascot" instead of "tap the mascot". Below this a tap still sprays
// ink and opens the assistant, exactly as before.
const DRAG_THRESHOLD_PX = 6;

// Where the owner last parked it. Survives a reload, because having to
// drag it out of the way again on every page would be worse than the
// wandering it replaces.
const PINNED_STORAGE_KEY = "octopus-mascot-pinned";
// How long the mascot sits still in one spot before relocating. The
// travel itself only takes ~1.5-2.5s (see the wander spring constants
// in the animation loop), so most of this window is genuine rest, not
// motion — it should read as "settles somewhere, then moves on", not
// continuous drift.
const WANDER_MIN_INTERVAL_MS = 7000;
const WANDER_MAX_INTERVAL_MS = 13000;
// Once within this distance (px) and speed of the wander target, snap
// to it exactly and zero the velocity instead of letting the spring
// asymptotically crawl forever — without this it never actually stops,
// it just keeps inching toward the target until the next one is picked.
const WANDER_SETTLE_DIST = 0.5;
const WANDER_SETTLE_SPEED = 0.3;

// Below this viewport width, most of the screen is occupied by
// full-width page content (forms, cards) with little safe empty space -
// wandering the full screen there means it frequently lands on top of
// real buttons/text, and since the mascot's own hit-box has
// pointer-events: auto, that would actually block real taps. Until the
// mascot is content-aware (a later phase), keep it confined to a
// narrow lane along the screen edge on small screens instead.
const MOBILE_BREAKPOINT = 640;
const MOBILE_LANE_WIDTH = 150;

// The body-reaction spring (see wrap.__setBounce below) - snappier and
// less damped than the tilt/wander springs above so a kick actually
// overshoots and settles with a visible "boing" instead of easing
// straight back to rest.
const BOUNCE_SPRING_STIFFNESS = 0.36;
const BOUNCE_SPRING_DAMPING = 0.8;
// How hard the ink-spray event kicks the bounce spring's velocity.
const BOUNCE_KICK_INK = 0.42;
// bounceScale drives a squash-and-stretch, not a uniform scale - these
// are the per-axis multipliers applied to (bounceScale - 1). Positive on
// X, negative on Y means growth phases bulge sideways while compressing
// vertically (and the reverse on the rebound), which reads as an actual
// squeeze reaction instead of a flat inflate/deflate pulse.
const BOUNCE_STRETCH_X = 1.3;
const BOUNCE_STRETCH_Y = -0.6;
// How hard the body recoils (tilt-velocity kick, opposite the spray
// direction) at the instant ink erupts - degrees/frame in the same units
// as the pointer-tilt spring above it shares velX/velY with.
const RECOIL_KICK_X = 11;
const RECOIL_KICK_Y = 6;

function springStep(pos, vel, target, stiffness, damping) {
  const force = (target - pos) * stiffness;
  const newVel = (vel + force) * damping;
  return [pos + newVel, newVel];
}

/**
 * OctopusMascot
 *
 * The single site-wide mascot instance — mounted once in the root layout
 * as a fixed-position element that wanders the viewport on its own, and
 * layers on top of the Lottie animation:
 *   - autonomous wandering movement (picks a new spot every 5-9s, drifts
 *     there with a slow spring)
 *   - a spring-driven 3D parallax tilt that follows the pointer (mouse
 *     hover on desktop, active touch-drag on mobile — Pointer Events
 *     unify both instead of separate mouse/touch code paths)
 *   - a continuous, organic idle sway (independent of the pointer)
 *   - two small overlay dots that track the pointer to fake pupil-tracking
 *   - an ink-splash burst on click/tap, using an SVG goo/turbulence filter
 *
 * Usage: mounted once, in app/layout.tsx — not meant to be placed inline
 * on individual pages anymore.
 *   import OctopusMascot from "@/components/OctopusMascot";
 *   <OctopusMascot />
 */
export default function OctopusMascot({
  size = 120,
  animationPath = "/animations/octopus.json",
  className = "",
}) {
  const outerRef = useRef(null);
  const wrapRef = useRef(null);
  const inkLayerRef = useRef(null);
  const filterId = `octopus-ink-goo-${useId().replace(/:/g, "")}`;
  const [animationData, setAnimationData] = useState(null);
  const [effectiveSize, setEffectiveSize] = useState(size);
  const { user } = useSession();
  const { open: openAssistantChat } = useAssistantChat();

  // Smaller footprint on narrow screens - a 120px mascot is a big chunk
  // of a ~390px-wide phone screen.
  useEffect(() => {
    function updateSize() {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setEffectiveSize(mobile ? Math.min(size, 90) : size);
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [size]);

  useEffect(() => {
    let cancelled = false;

    fetch(animationPath)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [animationPath]);

  // Wandering + pointer-follow tilt + idle sway + eye tracking, all driven
  // by one shared animation loop so they compose into transforms on two
  // nested elements instead of fighting each other:
  //   outerRef  (fixed, viewport position) <- wander target
  //   wrapRef   (relative, inside outer)   <- tilt/idle/bounce
  useEffect(() => {
    if (!animationData) return;
    const outer = outerRef.current;
    const wrap = wrapRef.current;
    if (!outer || !wrap) return;

    let targetX = 0,
      targetY = 0,
      curX = 0,
      curY = 0,
      velX = 0,
      velY = 0,
      idlePhase = Math.random() * 100,
      bounceScale = 1,
      bounceVel = 0,
      raf;

    // --- wandering state ---
    const isMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

    // On mobile, confine X to a narrow lane at the screen edge instead of
    // the full width - see MOBILE_LANE_WIDTH comment above.
    const laneMinX = () =>
      window.innerWidth - MOBILE_LANE_WIDTH - WANDER_MARGIN.right;
    const laneMaxSpanX = () =>
      Math.max(0, MOBILE_LANE_WIDTH - effectiveSize - WANDER_MARGIN.right);

    const bottomMargin = () =>
      isMobile() ? MOBILE_BOTTOM_MARGIN : WANDER_MARGIN.bottom;

    const maxWanderX = () =>
      Math.max(0, window.innerWidth - effectiveSize - WANDER_MARGIN.left - WANDER_MARGIN.right);
    const maxWanderY = () =>
      Math.max(0, window.innerHeight - effectiveSize - WANDER_MARGIN.top - bottomMargin());

    function randomWanderX() {
      if (isMobile()) {
        return laneMinX() + Math.random() * laneMaxSpanX();
      }
      return WANDER_MARGIN.left + Math.random() * maxWanderX();
    }

    // Keeps a position on screen whatever the window is doing - used
    // both when dropping the mascot and after a resize or rotation.
    const clampX = (x) =>
      Math.max(0, Math.min(x, window.innerWidth - effectiveSize));
    const clampY = (y) =>
      Math.max(0, Math.min(y, window.innerHeight - effectiveSize));

    let pinned = false;
    let stored = null;

    // Private-mode browsers throw on access rather than returning null,
    // so this has to be guarded, and a missing value is a normal state.
    try {
      const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
          stored = parsed;
        }
      }
    } catch {
      stored = null;
    }

    let wanderX = stored ? clampX(stored.x) : randomWanderX();
    let wanderY = stored
      ? clampY(stored.y)
      : WANDER_MARGIN.top + Math.random() * maxWanderY();

    if (stored) pinned = true;

    let wanderTargetX = wanderX;
    let wanderTargetY = wanderY;
    let wanderVelX = 0;
    let wanderVelY = 0;
    let wanderTimer;

    function pickNewWanderTarget() {
      // Parked by hand. Leave it exactly where it was put.
      if (pinned) return;

      wanderTargetX = randomWanderX();
      wanderTargetY = WANDER_MARGIN.top + Math.random() * maxWanderY();

      const delay =
        WANDER_MIN_INTERVAL_MS +
        Math.random() * (WANDER_MAX_INTERVAL_MS - WANDER_MIN_INTERVAL_MS);
      wanderTimer = setTimeout(pickNewWanderTarget, delay);
    }

    if (!pinned) wanderTimer = setTimeout(pickNewWanderTarget, 2000);

    // --- dragging: pick it up and put it down where you want it ---
    //
    // The complaint this answers: it drifts onto the button you are
    // about to press and you wait for it to move on. Now you move it.
    //
    // A press only becomes a drag after DRAG_THRESHOLD_PX, so a plain
    // tap still sprays ink and opens the assistant. Dropping it pins it
    // and the wandering stops; double-tap sets it loose again.
    let pressing = false;
    let didDrag = false;
    let grabDx = 0;
    let grabDy = 0;

    const handleDragStart = (e) => {
      pressing = true;
      didDrag = false;
      grabDx = e.clientX - wanderX;
      grabDy = e.clientY - wanderY;

      try {
        wrap.setPointerCapture(e.pointerId);
      } catch {
        // capture is a nicety, not a requirement
      }
    };

    const handleDragMove = (e) => {
      if (!pressing) return;

      const nextX = clampX(e.clientX - grabDx);
      const nextY = clampY(e.clientY - grabDy);

      if (
        !didDrag &&
        Math.hypot(nextX - wanderX, nextY - wanderY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }

      didDrag = true;

      // Written straight to position with the spring zeroed: while a
      // finger is on it, it should track the finger exactly, not lag
      // behind on a spring.
      wanderX = nextX;
      wanderY = nextY;
      wanderTargetX = nextX;
      wanderTargetY = nextY;
      wanderVelX = 0;
      wanderVelY = 0;
    };

    const handleDragEnd = () => {
      if (!pressing) return;

      pressing = false;

      if (!didDrag) return;

      pinned = true;
      clearTimeout(wanderTimer);

      try {
        window.localStorage.setItem(
          PINNED_STORAGE_KEY,
          JSON.stringify({ x: wanderX, y: wanderY })
        );
      } catch {
        // remembering is a bonus; being where it was dropped is not
      }
    };

    // Double-tap hands it back to its own devices.
    const handleUnpin = () => {
      pinned = false;

      try {
        window.localStorage.removeItem(PINNED_STORAGE_KEY);
      } catch {
        // nothing to clean up
      }

      clearTimeout(wanderTimer);
      pickNewWanderTarget();
    };

    // A rotation or a resized window can leave a parked mascot off
    // screen entirely, where it cannot be dragged back.
    const handleResize = () => {
      wanderX = clampX(wanderX);
      wanderY = clampY(wanderY);
      wanderTargetX = clampX(wanderTargetX);
      wanderTargetY = clampY(wanderTargetY);
    };

    // --- pointer tracking (mouse + touch, unified via Pointer Events) ---
    const handlePointerMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const relX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const relY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      targetX = Math.max(-1, Math.min(1, relX)) * 18;
      targetY = Math.max(-1, Math.min(1, relY)) * 10;
    };

    const resetTilt = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      idlePhase += 0.02;
      const idleTiltX = Math.sin(idlePhase * 0.6) * 1.5 + Math.sin(idlePhase * 0.23) * 0.8;
      const idleBobY = Math.sin(idlePhase * 0.4) * 3;

      [curX, velX] = springStep(curX, velX, targetX, 0.09, 0.82);
      [curY, velY] = springStep(curY, velY, targetY, 0.09, 0.82);
      [bounceScale, bounceVel] = springStep(
        bounceScale,
        bounceVel,
        1,
        BOUNCE_SPRING_STIFFNESS,
        BOUNCE_SPRING_DAMPING
      );

      [wanderX, wanderVelX] = springStep(wanderX, wanderVelX, wanderTargetX, 0.012, 0.82);
      [wanderY, wanderVelY] = springStep(wanderY, wanderVelY, wanderTargetY, 0.012, 0.82);

      // hard settle: stop for real once close enough, instead of the
      // spring crawling toward the target forever without ever arriving
      if (
        Math.hypot(wanderTargetX - wanderX, wanderTargetY - wanderY) < WANDER_SETTLE_DIST &&
        Math.hypot(wanderVelX, wanderVelY) < WANDER_SETTLE_SPEED
      ) {
        wanderX = wanderTargetX;
        wanderY = wanderTargetY;
        wanderVelX = 0;
        wanderVelY = 0;
      }

      outer.style.transform = `translate(${wanderX}px, ${wanderY}px)`;

      const bounceOffset = bounceScale - 1;
      const scaleX = 1 + bounceOffset * BOUNCE_STRETCH_X;
      const scaleY = 1 + bounceOffset * BOUNCE_STRETCH_Y;

      wrap.style.transform = `perspective(600px) translateY(${idleBobY}px) rotateY(${
        curX + idleTiltX
      }deg) rotateX(${-curY}deg) scale(${scaleX}, ${scaleY})`;

      raf = requestAnimationFrame(tick);
    };

    // Pointer Events cover mouse, touch and pen with one code path.
    // On touch devices "move" only fires while a finger is actively
    // dragging (no ambient hover), which is the correct mobile analogue.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", resetTilt);
    window.addEventListener("pointercancel", resetTilt);
    wrap.addEventListener("pointerleave", resetTilt);

    wrap.addEventListener("pointerdown", handleDragStart);
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
    wrap.addEventListener("dblclick", handleUnpin);
    window.addEventListener("resize", handleResize);

    // Read by the click handler so a drag that ends over the mascot
    // does not also count as a tap and open the assistant.
    wrap.__wasDragged = () => didDrag;

    tick();

    // Both kick velocity rather than snap position directly, so the
    // existing spring (see tick above) does the work of overshooting and
    // settling instead of a scripted animation.
    wrap.__setBounce = (kick) => {
      bounceVel += kick;
    };
    wrap.__addRecoil = (angle, magX, magY) => {
      // opposite the spray direction, like recoil from expelling force
      velX += -Math.cos(angle) * magX;
      velY += -Math.sin(angle) * magY;
    };

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", resetTilt);
      window.removeEventListener("pointercancel", resetTilt);
      wrap.removeEventListener("pointerleave", resetTilt);

      wrap.removeEventListener("pointerdown", handleDragStart);
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
      wrap.removeEventListener("dblclick", handleUnpin);
      window.removeEventListener("resize", handleResize);

      clearTimeout(wanderTimer);
      cancelAnimationFrame(raf);
    };
  }, [animationData, effectiveSize]);

  const spawnInk = useCallback(
    (clientX, clientY) => {
      const wrap = wrapRef.current;
      const inkLayer = inkLayerRef.current;
      if (!wrap || !inkLayer) return;
      const rect = wrap.getBoundingClientRect();

      // The ink always erupts from the fixed body point, not from
      // wherever was clicked/tapped - it "squirts", it doesn't just
      // appear under the cursor. The click point only steers which
      // direction it sprays in.
      const originX = INK_ORIGIN.x * effectiveSize;
      const originY = INK_ORIGIN.y * effectiveSize;
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const baseAngle = Math.atan2(clickY - originY, clickX - originX);

      // Plain circles — the goo/turbulence SVG filter on inkLayer is what
      // gives them the organic, branching "ink diffusing in water" edge,
      // not the shape of the elements themselves. A cone of angles around
      // baseAngle (not a full 360 burst) so it reads as a directional jet
      // from the body rather than an omnidirectional pop.
      for (let i = 0; i < 8; i++) {
        const drop = document.createElement("div");
        const dropSize = 10 + Math.random() * 26;
        const angle = baseAngle + (Math.random() - 0.5) * 1.7; // ~±49°
        const dist = 20 + Math.random() * 65;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        const isHighlight = Math.random() < INK_HIGHLIGHT_CHANCE;
        const color = isHighlight
          ? INK_HIGHLIGHT_COLORS[Math.floor(Math.random() * INK_HIGHLIGHT_COLORS.length)]
          : INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)];

        Object.assign(drop.style, {
          position: "absolute",
          left: `${originX}px`,
          top: `${originY}px`,
          width: "3px",
          height: "3px",
          borderRadius: "50%",
          background: color,
          opacity: isHighlight ? "0.35" : "0.92",
          mixBlendMode: isHighlight ? "screen" : "normal",
          pointerEvents: "none",
          // size/position spread over 0.7s so the goo filter has time to
          // show a connected, branching shape; opacity fades later and
          // faster, like ink dispersing/being absorbed into water
          transition:
            "left 0.7s cubic-bezier(0.16, 1, 0.3, 1), top 0.7s cubic-bezier(0.16, 1, 0.3, 1), width 0.7s cubic-bezier(0.16, 1, 0.3, 1), height 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-in 0.25s",
        });
        inkLayer.appendChild(drop);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            drop.style.left = `${originX + dx}px`;
            drop.style.top = `${originY + dy}px`;
            drop.style.width = `${dropSize}px`;
            drop.style.height = `${dropSize}px`;
            drop.style.opacity = "0";
          });
        });

        setTimeout(() => drop.remove(), 800);
      }

      // excited bounce + a recoil kick opposite the spray direction, both
      // read by the animation loop each frame so they don't get
      // overwritten by the tilt/idle transform - together they read as
      // the body actually reacting to expelling the ink, not just the
      // ink itself moving.
      if (wrap.__setBounce) wrap.__setBounce(BOUNCE_KICK_INK);
      if (wrap.__addRecoil) wrap.__addRecoil(baseAngle, RECOIL_KICK_X, RECOIL_KICK_Y);
    },
    [effectiveSize]
  );

  // Clicking the mascot itself always sprays ink. If the current user is
  // the business owner, it also opens the assistant chat - the ink
  // "becomes" the chat panel (see AssistantChat.tsx's own blob growth
  // animation, which starts from this same origin point). Anyone
  // else (employee, or logged out on /login) only gets the ink; there is
  // no attempt to open the chat, since AssistantChat itself refuses to
  // render for non-owners anyway - the real access control is the 403 in
  // app/api/assistant/route.ts, this is just not offering a UI that
  // would do nothing.
  const handleMascotClick = useCallback(
    (e) => {
      // Letting go after dragging it somewhere is not a request to
      // open the assistant.
      if (wrapRef.current?.__wasDragged?.()) return;

      spawnInk(e.clientX, e.clientY);
      if (user?.role === "owner") {
        // Same origin point the ink itself erupts from, so the chat
        // panel's ink-flood entrance (AssistantChat.tsx) starts exactly
        // where this splash did instead of some unrelated fixed point.
        const rect = wrapRef.current?.getBoundingClientRect();
        const origin = rect
          ? {
              x: rect.left + INK_ORIGIN.x * effectiveSize,
              y: rect.top + INK_ORIGIN.y * effectiveSize,
            }
          : undefined;
        openAssistantChat(origin);
      }
    },
    [spawnInk, user, openAssistantChat, effectiveSize]
  );

  return (
    <div
      ref={outerRef}
      // print:hidden is not optional here - the mascot is fixed over the
      // whole viewport, so without it a customer's receipt comes out of
      // the thermal printer with a cartoon octopus on it.
      className={`print:hidden${className ? ` ${className}` : ""}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: effectiveSize,
        height: effectiveSize,
        // Below the app's own fixed furniture (bottom nav and the
        // till's basket bar are z-40) so it can never cover a control,
        // still above ordinary page content.
        zIndex: 30,
        pointerEvents: "none",
        willChange: "transform",
      }}
    >
      <div
        ref={wrapRef}
        onClick={handleMascotClick}
        title="اسحبه لأي مكان · دوس عليه مرتين يرجع يتحرك لوحده"
        style={{
          position: "relative",
          width: effectiveSize,
          height: effectiveSize,
          cursor: "grab",
          pointerEvents: "auto",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {animationData && (
          <>
            <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
              <defs>
                <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
                    result="goo"
                  />
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.025 0.05"
                    numOctaves="2"
                    seed="7"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="goo"
                    in2="noise"
                    scale="30"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
              </defs>
            </svg>

            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: "100%", height: "100%" }}
            />
            <div
              ref={inkLayerRef}
              style={{
                position: "absolute",
                inset: 0,
                filter: `url(#${filterId})`,
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
