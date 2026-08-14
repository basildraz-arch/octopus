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

function springStep(pos, vel, target, stiffness, damping) {
  const force = (target - pos) * stiffness;
  const newVel = (vel + force) * damping;
  return [pos + newVel, newVel];
}

/**
 * OctopusMascot
 *
 * Renders the real Octopus Lottie animation (public/animations/octopus.json)
 * and layers on top of it:
 *   - a spring-driven 3D parallax tilt that follows the cursor
 *   - a continuous, organic idle sway (independent of the cursor)
 *   - two small overlay dots that track the cursor to fake pupil-tracking,
 *     positioned over the Lottie's own (baked, non-interactive) pupils
 *   - an ink-splash burst on click/tap, using an SVG goo/turbulence filter
 *     so the splash reads as organic branching ink, not geometric dots
 *
 * Usage:
 *   import OctopusMascot from "@/components/OctopusMascot";
 *   <OctopusMascot size={220} />
 *
 * Uses lottie-react (already a project dependency) instead of lottie-web
 * directly, matching the pattern already used in AssistantChat.tsx.
 */
export default function OctopusMascot({
  size = 220,
  animationPath = "/animations/octopus.json",
  className = "",
}) {
  const wrapRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const inkLayerRef = useRef(null);
  const filterId = `octopus-ink-goo-${useId().replace(/:/g, "")}`;
  const [animationData, setAnimationData] = useState(null);

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

  // Cursor-follow parallax tilt + idle sway + eye tracking, all driven by
  // one shared animation loop so they compose into a single transform
  // instead of fighting each other.
  useEffect(() => {
    if (!animationData) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    let targetX = 0,
      targetY = 0,
      curX = 0,
      curY = 0,
      velX = 0,
      velY = 0,
      idlePhase = Math.random() * 100,
      bounceScale = 1,
      raf;

    const handleMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const relX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const relY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      targetX = Math.max(-1, Math.min(1, relX)) * 18;
      targetY = Math.max(-1, Math.min(1, relY)) * 10;
    };

    const handleLeave = () => {
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

    window.addEventListener("mousemove", handleMove);
    wrap.addEventListener("mouseleave", handleLeave);
    tick();

    wrap.__setBounce = (v) => {
      bounceScale = v;
    };

    return () => {
      window.removeEventListener("mousemove", handleMove);
      wrap.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(raf);
    };
  }, [animationData]);

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
    left: `${rest.x * size - 3}px`,
    top: `${rest.y * size - 3}px`,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#12151F",
    pointerEvents: "none",
  });

  return (
    <div
      ref={wrapRef}
      onClick={(e) => spawnInk(e.clientX, e.clientY)}
      className={className}
      style={{
        position: "relative",
        width: size,
        height: size,
        cursor: "pointer",
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
  );
}
