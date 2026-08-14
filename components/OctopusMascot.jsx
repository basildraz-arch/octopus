"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Lottie from "lottie-react";

// ---- Design tokens — matched to the octopus's own palette ----
const INK_COLORS = ["#2FD9C4", "#6C5CE7", "#1FAE9C", "#4C3FB5"];

/**
 * OctopusMascot
 *
 * Renders the real Octopus Lottie animation (public/animations/octopus.json)
 * and layers on top of it:
 *   - a subtle 3D parallax tilt that follows the cursor
 *   - an ink-splash burst on click/tap
 *
 * Usage:
 *   import OctopusMascot from "@/components/OctopusMascot";
 *   <OctopusMascot size={220} />
 *
 * Drop this once in your root layout (app/layout.tsx) with `fixed`
 * positioning if you want it persistent across every page, or place it
 * inline on a specific page (e.g. the login screen you already have it on).
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

  // Cursor-follow parallax tilt
  useEffect(() => {
    if (!animationData) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    let targetX = 0,
      targetY = 0,
      curX = 0,
      curY = 0,
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
      curX += (targetX - curX) * 0.15;
      curY += (targetY - curY) * 0.15;
      wrap.style.transform = `perspective(600px) rotateY(${curX}deg) rotateX(${-curY}deg)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMove);
    wrap.addEventListener("mouseleave", handleLeave);
    tick();

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

    // small excited bounce
    wrap.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
    wrap.style.transform += " scale(1.08)";
    setTimeout(() => {
      wrap.style.transition = "transform 0.15s ease-out";
    }, 250);
  }, []);

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
        <Lottie
          animationData={animationData}
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
