"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import Lottie from "lottie-react";

// ---- Design tokens — matched to the octopus's own palette ----
const INK_COLORS = ["#2FD9C4", "#6C5CE7", "#1FAE9C", "#4C3FB5"];

// Pupil rest position as a fraction of the container size, measured
// pixel-by-pixel from the rendered artwork (see git history for the
// measurement script) — not a guess.
const EYE_REST = {
  left: { x: 0.408, y: 0.436 },
  right: { x: 0.570, y: 0.442 },
};
const EYE_MAX_OFFSET = 3; // px the pupil overlay is allowed to travel

// How much empty space to keep clear at each viewport edge while
// wandering, so the mascot never gets clipped or sits under the
// bottom nav / toast stack.
const WANDER_MARGIN = { top: 70, bottom: 100, left: 16, right: 16 };
const WANDER_MIN_INTERVAL_MS = 5000;
const WANDER_MAX_INTERVAL_MS = 9000;

// Below this viewport width, most of the screen is occupied by
// full-width page content (forms, cards) with little safe empty space -
// wandering the full screen there means it frequently lands on top of
// real buttons/text, and since the mascot's own hit-box has
// pointer-events: auto, that would actually block real taps. Until the
// mascot is content-aware (a later phase), keep it confined to a
// narrow lane along the screen edge on small screens instead.
const MOBILE_BREAKPOINT = 640;
const MOBILE_LANE_WIDTH = 150;

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
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const inkLayerRef = useRef(null);
  const filterId = `octopus-ink-goo-${useId().replace(/:/g, "")}`;
  const [animationData, setAnimationData] = useState(null);
  const [effectiveSize, setEffectiveSize] = useState(size);

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
    wanderTimer = setTimeout(pickNewWanderTarget, 1500);

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
      bounceScale += (1 - bounceScale) * 0.2;

      [wanderX, wanderVelX] = springStep(wanderX, wanderVelX, wanderTargetX, 0.0025, 0.9);
      [wanderY, wanderVelY] = springStep(wanderY, wanderVelY, wanderTargetY, 0.0025, 0.9);
      outer.style.transform = `translate(${wanderX}px, ${wanderY}px)`;

      wrap.style.transform = `perspective(600px) translateY(${idleBobY}px) rotateY(${
        curX + idleTiltX
      }deg) rotateX(${-curY}deg) scale(${bounceScale})`;

      const eyeOffsetX = (curX / 18) * EYE_MAX_OFFSET;
      const eyeOffsetY = (curY / 10) * EYE_MAX_OFFSET;
      const eyeTransform = `translate(${eyeOffsetX}px, ${eyeOffsetY}px)`;
      if (leftEyeRef.current) leftEyeRef.current.style.transform = eyeTransform;
      if (rightEyeRef.current) rightEyeRef.current.style.transform = eyeTransform;

      raf = requestAnimationFrame(tick);
    };

    // Pointer Events cover mouse, touch and pen with one code path.
    // On touch devices "move" only fires while a finger is actively
    // dragging (no ambient hover), which is the correct mobile analogue.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", resetTilt);
    window.addEventListener("pointercancel", resetTilt);
    wrap.addEventListener("pointerleave", resetTilt);
    tick();

    wrap.__setBounce = (v) => {
      bounceScale = v;
    };

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", resetTilt);
      window.removeEventListener("pointercancel", resetTilt);
      wrap.removeEventListener("pointerleave", resetTilt);
      clearTimeout(wanderTimer);
      cancelAnimationFrame(raf);
    };
  }, [animationData, effectiveSize]);

  const spawnInk = useCallback((clientX, clientY) => {
    const wrap = wrapRef.current;
    const inkLayer = inkLayerRef.current;
    if (!wrap || !inkLayer) return;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Plain circles — the goo/turbulence SVG filter on inkLayer is what
    // gives them the organic, branching "ink diffusing in water" edge,
    // not the shape of the elements themselves. Kept close together
    // (small spread) so they overlap enough for the filter to merge them
    // into one connected plume instead of separate dots.
    for (let i = 0; i < 7; i++) {
      const drop = document.createElement("div");
      const dropSize = 10 + Math.random() * 26;
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 55;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const color = INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)];

      Object.assign(drop.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: "3px",
        height: "3px",
        borderRadius: "50%",
        background: color,
        opacity: "0.75",
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
          drop.style.left = `${x + dx}px`;
          drop.style.top = `${y + dy}px`;
          drop.style.width = `${dropSize}px`;
          drop.style.height = `${dropSize}px`;
          drop.style.opacity = "0";
        });
      });

      setTimeout(() => drop.remove(), 800);
    }

    // excited bounce, read by the animation loop each frame so it
    // doesn't get overwritten by the tilt/idle transform
    if (wrap.__setBounce) wrap.__setBounce(1.08);
  }, []);

  const eyeDotStyle = (rest) => ({
    position: "absolute",
    left: `${rest.x * effectiveSize - 3}px`,
    top: `${rest.y * effectiveSize - 3}px`,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#12151F",
    pointerEvents: "none",
  });

  return (
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
        onClick={(e) => spawnInk(e.clientX, e.clientY)}
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
            <div ref={leftEyeRef} style={eyeDotStyle(EYE_REST.left)} />
            <div ref={rightEyeRef} style={eyeDotStyle(EYE_REST.right)} />
            <div
              ref={inkLayerRef}
              style={{
                position: "absolute",
                inset: 0,
                filter: `url(#${filterId})`,
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
