"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
 *   - an ink-splash burst on click/tap
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
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = 0; i < 8; i++) {
      const drop = document.createElement("div");
      const dropSize = 4 + Math.random() * 22;
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 70;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const color = INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)];

      // irregular blob shape (not a perfect circle) so it reads as ink, not a bubble
      const blobRadius = `${40 + Math.random() * 30}% ${40 + Math.random() * 30}% ${
        40 + Math.random() * 30
      }% ${40 + Math.random() * 30}% / ${40 + Math.random() * 30}% ${
        40 + Math.random() * 30
      }% ${40 + Math.random() * 30}% ${40 + Math.random() * 30}%`;

      Object.assign(drop.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: "3px",
        height: "3px",
        borderRadius: blobRadius,
        background: color,
        opacity: "0.95",
        pointerEvents: "none",
        // size/position spread over 0.6s, but opacity fades faster (0.4s) —
        // reads as ink being absorbed rather than a bubble drifting off
        transition:
          "left 0.6s cubic-bezier(0.16, 1, 0.3, 1), top 0.6s cubic-bezier(0.16, 1, 0.3, 1), width 0.6s cubic-bezier(0.16, 1, 0.3, 1), height 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out",
      });
      wrap.appendChild(drop);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drop.style.left = `${x + dx}px`;
          drop.style.top = `${y + dy}px`;
          drop.style.width = `${dropSize}px`;
          drop.style.height = `${dropSize}px`;
          drop.style.opacity = "0";
        });
      });

      setTimeout(() => drop.remove(), 650);
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
          <Lottie
            animationData={animationData}
            loop
            autoplay
            style={{ width: "100%", height: "100%" }}
          />
          <div ref={leftEyeRef} style={eyeDotStyle(EYE_REST.left)} />
          <div ref={rightEyeRef} style={eyeDotStyle(EYE_REST.right)} />
        </>
      )}
    </div>
  );
}
