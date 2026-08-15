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

// The arm only reaches for clicks/taps within this radius (px) of the
// octopus's current on-screen position - a deliberate constraint so it
// never "chases" something far across the page, only reacts to things
// near wherever it already happens to be standing.
const ARM_REACH_DISTANCE = 280;
const ARM_REACH_DISTANCE_MOBILE = 180;
const ARM_GROW_MS = 260;
const ARM_HOLD_MS = 120;
const ARM_RETRACT_MS = 220;
const ARM_COLOR = INK_COLORS[0];

// The body-reaction spring (see wrap.__setBounce below) - snappier and
// less damped than the tilt/wander springs above so a kick actually
// overshoots and settles with a visible "boing" instead of easing
// straight back to rest.
const BOUNCE_SPRING_STIFFNESS = 0.36;
const BOUNCE_SPRING_DAMPING = 0.8;
// How hard each event kicks the bounce spring's velocity - ink spraying
// is the bigger, more physical reaction; the arm's tap is a lighter one.
const BOUNCE_KICK_INK = 0.42;
const BOUNCE_KICK_ARM = 0.22;
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
  const armPathRef = useRef(null);
  const armTipRef = useRef(null);
  const armBusyRef = useRef(false);
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

    const maxWanderX = () =>
      Math.max(0, window.innerWidth - effectiveSize - WANDER_MARGIN.left - WANDER_MARGIN.right);
    const maxWanderY = () =>
      Math.max(0, window.innerHeight - effectiveSize - WANDER_MARGIN.top - WANDER_MARGIN.bottom);

    function randomWanderX() {
      if (isMobile()) {
        return laneMinX() + Math.random() * laneMaxSpanX();
      }
      return WANDER_MARGIN.left + Math.random() * maxWanderX();
    }

    let wanderX = randomWanderX();
    let wanderY = WANDER_MARGIN.top + Math.random() * maxWanderY();
    let wanderTargetX = wanderX;
    let wanderTargetY = wanderY;
    let wanderVelX = 0;
    let wanderVelY = 0;
    let wanderTimer;

    function pickNewWanderTarget() {
      wanderTargetX = randomWanderX();
      wanderTargetY = WANDER_MARGIN.top + Math.random() * maxWanderY();

      const delay =
        WANDER_MIN_INTERVAL_MS +
        Math.random() * (WANDER_MAX_INTERVAL_MS - WANDER_MIN_INTERVAL_MS);
      wanderTimer = setTimeout(pickNewWanderTarget, delay);
    }
    wanderTimer = setTimeout(pickNewWanderTarget, 2000);

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

    // --- arm reach: the octopus stretches an arm toward whatever the
    // user just clicked/tapped, but only if it landed close to where the
    // mascot currently is (see ARM_REACH_DISTANCE comment above) ---
    const armTimers = [];

    function triggerArmReach(clientX, clientY) {
      const path = armPathRef.current;
      const tip = armTipRef.current;
      if (!path || !tip || armBusyRef.current) return;

      const rect = wrap.getBoundingClientRect();
      const originX = rect.left + INK_ORIGIN.x * effectiveSize;
      const originY = rect.top + INK_ORIGIN.y * effectiveSize;
      const dist = Math.hypot(clientX - originX, clientY - originY);
      const maxReach = isMobile() ? ARM_REACH_DISTANCE_MOBILE : ARM_REACH_DISTANCE;
      if (dist > maxReach || dist < 4) return;

      armBusyRef.current = true;

      // Bow the curve out to one side so the arm reads as a flexible
      // tentacle instead of a rigid rod - perpendicular offset from the
      // straight line to the target, capped so short reaches don't
      // over-curve.
      const midX = (originX + clientX) / 2;
      const midY = (originY + clientY) / 2;
      const dx = clientX - originX;
      const dy = clientY - originY;
      const bow = Math.min(dist * 0.25, 36);
      const ctrlX = midX + (-dy / dist) * bow;
      const ctrlY = midY + (dx / dist) * bow;

      path.setAttribute("d", `M ${originX} ${originY} Q ${ctrlX} ${ctrlY} ${clientX} ${clientY}`);
      const length = path.getTotalLength();
      path.style.transition = "none";
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.opacity = "1";
      tip.style.transition = "none";
      tip.style.opacity = "0";
      tip.style.r = "0px";
      tip.style.cx = `${originX}px`;
      tip.style.cy = `${originY}px`;

      // same "hidden state, then animate" pattern as spawnInk: two nested
      // rAFs so the browser actually paints the zero-progress frame
      // before the transition kicks in, instead of coalescing both style
      // writes into one paint and skipping the animation entirely.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          path.style.transition = `stroke-dashoffset ${ARM_GROW_MS}ms cubic-bezier(0.3, 1.4, 0.5, 1)`;
          path.style.strokeDashoffset = "0";
        });
      });

      if (wrap.__setBounce) wrap.__setBounce(BOUNCE_KICK_ARM);

      // arrival: a small "tap" pulse at the fingertip
      armTimers.push(
        setTimeout(() => {
          tip.style.transition = "none";
          tip.style.cx = `${clientX}px`;
          tip.style.cy = `${clientY}px`;
          tip.style.r = "3px";
          tip.style.opacity = "0.85";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              tip.style.transition = `r ${ARM_HOLD_MS}ms ease-out, opacity ${ARM_HOLD_MS}ms ease-out`;
              tip.style.r = "11px";
              tip.style.opacity = "0";
            });
          });
        }, ARM_GROW_MS)
      );

      // retract: unwind the same draw animation backwards so the arm
      // erases from the tip back toward the body, instead of just
      // vanishing.
      armTimers.push(
        setTimeout(() => {
          path.style.transition = `stroke-dashoffset ${ARM_RETRACT_MS}ms ease-in`;
          path.style.strokeDashoffset = `${length}`;
        }, ARM_GROW_MS + ARM_HOLD_MS)
      );

      armTimers.push(
        setTimeout(() => {
          path.style.opacity = "0";
          path.setAttribute("d", "");
          armBusyRef.current = false;
        }, ARM_GROW_MS + ARM_HOLD_MS + ARM_RETRACT_MS)
      );
    }

    // Global click - reacts to anything on the page, not just the
    // mascot's own hit-box. The mascot's own click (ink/chat) is handled
    // separately by handleMascotClick, so it's excluded here. Nothing is
    // prevented or stopped - the real click still reaches its real
    // target, this only layers a visual on top.
    const handleGlobalClick = (e) => {
      if (wrap.contains(e.target)) return;
      triggerArmReach(e.clientX, e.clientY);
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
    window.addEventListener("click", handleGlobalClick);
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
      window.removeEventListener("click", handleGlobalClick);
      armTimers.forEach(clearTimeout);
      armBusyRef.current = false;
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

  const armWidth = Math.max(6, effectiveSize * 0.08);

  return (
    <>
      <div
        ref={outerRef}
        className={className}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: effectiveSize,
          height: effectiveSize,
          zIndex: 40,
          pointerEvents: "none",
          willChange: "transform",
        }}
      >
        <div
          ref={wrapRef}
          onClick={handleMascotClick}
          style={{
            position: "relative",
            width: effectiveSize,
            height: effectiveSize,
            cursor: "pointer",
            pointerEvents: "auto",
            touchAction: "none",
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

      {/* Full-viewport overlay for the arm reach - lives outside the
          wandering `outer` element so its path coordinates are plain
          viewport coordinates, not affected by the wander translate. */}
      {animationData && (
        <svg
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 41,
          }}
        >
          <path
            ref={armPathRef}
            d=""
            fill="none"
            stroke={ARM_COLOR}
            strokeWidth={armWidth}
            strokeLinecap="round"
            style={{ opacity: 0 }}
          />
          <circle ref={armTipRef} cx={0} cy={0} r={0} fill={ARM_COLOR} style={{ opacity: 0 }} />
        </svg>
      )}
    </>
  );
}
