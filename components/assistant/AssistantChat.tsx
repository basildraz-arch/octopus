"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";

import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useAssistantChat } from "@/hooks/useAssistantChat";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  link?: { path: string; label: string };
  linkResolved?: "confirmed" | "dismissed";

  // Set when the answer was an instruction rather than a question.
  // The assistant has worked out exactly what it would change and is
  // waiting to be told to go ahead - nothing has happened yet.
  proposal?: {
    actionId: string;
    summary: string;
    affectedCount: number;
  };
  proposalResolved?: "executed" | "cancelled" | "failed";
  proposalMessage?: string;
};

type Point = { x: number; y: number };

// Lighter than OctopusMascot.jsx's own INK_COLORS on purpose - this blob
// sits over the page's near-black background (ink-950, #05070E), and the
// mascot's near-black palette barely showed up against it. Pulled a
// couple steps up the ink scale (ink-700/600-ish) so it reads clearly as
// its own shape instead of blending into the page.
const INK_COLORS = ["#1B1F2E", "#20263A", "#171B28"];
const BLOB_GRADIENT_LIGHT = "#2A2F42"; // ink-600
const BLOB_GRADIENT_DARK = "#0A0D17"; // ink-900
const BLOB_RIM_COLOR = "#17C3B2"; // splash accent, used as a thin glow rim

// How many points make up the main blob's outline - a smooth closed
// curve is fit through them (see catmullRomPath below), so this controls
// how fine-grained the silhouette's bulges are.
const BLOB_POINTS = 12;
const RAY_COUNT = 8;
const DROPLET_COUNT = 14;

// Per-point radius spring - how snappily each point chases its target
// radius. Same springStep math as OctopusMascot.jsx's tilt/wander/bounce
// springs, just run over N independent scalars instead of one X/Y pair.
const RADIUS_STIFFNESS = 0.16;
const RADIUS_DAMPING = 0.76;
// The blob's overall center position spring - drives the "grows out of
// the octopus's position" entrance and "shrinks back into it" exit.
const CENTER_STIFFNESS = 0.1;
const CENTER_DAMPING = 0.78;

// Continuous idle wobble even with no pointer input, as a fraction of
// each point's own base radius - keeps the blob reading as alive at rest,
// not just during interaction.
const IDLE_WOBBLE = 0.07;
// How strongly the pointer pulls the nearest-facing points outward (and
// the far side in slightly) - fraction of base radius.
const POINTER_PULL = 0.24;
// Beyond this distance (px) from the blob's center, the pointer has
// ~zero effect - close up it reads as a strong "liquid magnet" pull.
const POINTER_RANGE = 480;

// The content area has no background/border of its own - it's clipped
// directly to a shrunk copy of the live blob outline (see the tick loop),
// pulled this many px inward from the real edge at every point. This is
// what keeps text away from the jagged, moving edge without needing a
// separate card to sit on top of the ink.
const SAFE_MARGIN_PX = 56;

// How long to wait after starting the close-collapse before actually
// unmounting - the spring never mathematically reaches exactly zero, so
// this just needs to be long enough that it's visually settled.
const CLOSE_ANIMATION_MS = 600;

function springStep(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number
): [number, number] {
  const force = (target - pos) * stiffness;
  const newVel = (vel + force) * damping;
  return [pos + newVel, newVel];
}

// Distance from the center to the edge of an axis-aligned, centered
// rectangle (half-width halfW, half-height halfH) along a ray at `angle`.
// This is the real geometric floor each blob point's target radius gets
// clamped to (see the tick loop) - without it, a point can randomly end
// up too small to clear the content rectangle in its direction, and the
// content gets sliced unevenly by the safe-clip, reading as "tilted".
function rectClearanceRadius(angle: number, halfW: number, halfH: number): number {
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const tx = c > 1e-6 ? halfW / c : Infinity;
  const ty = s > 1e-6 ? halfH / s : Infinity;
  return Math.min(tx, ty);
}

// Fits a smooth closed curve through `points` (Catmull-Rom converted to
// cubic Beziers - the standard construction behind most "organic blob"
// generators) - this is what turns a ring of plain X/Y coordinates into
// a soft, rounded, non-self-intersecting ink silhouette instead of a
// jagged polygon.
function catmullRomPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return "";

  let d = `M ${points[0].x} ${points[0].y} `;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y} `;
  }
  return d + "Z";
}

// Used only when the chat was opened without an origin point (defensive
// fallback - in practice AssistantChat is only ever opened by the mascot,
// which always passes one).
function fallbackOrigin(): Point {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  return { x: 24, y: window.innerHeight - 24 };
}

export default function AssistantChat() {
  const router = useRouter();
  const { user } = useSession();
  const { isOpen, origin, close } = useAssistantChat();

  const gradientId = `assistant-blob-gradient-${useId().replace(/:/g, "")}`;
  const safeClipId = `assistant-safe-clip-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const blobPathRef = useRef<SVGPathElement>(null);
  const safeClipPathRef = useRef<SVGPathElement>(null);
  const rayRefs = useRef<(SVGPathElement | null)[]>([]);
  const dropletRefs = useRef<(SVGCircleElement | null)[]>([]);
  // Imperative bridge from the isOpen-watcher effect below into the
  // running blob tick loop (in the other effect) - same pattern as
  // OctopusMascot's wrap.__setBounce: the loop owns all the live spring
  // state, so an external "please start closing" just flips a flag on
  // this ref instead of two effects duplicating the physics.
  const blobControlRef = useRef<{ startClose: () => void } | null>(null);

  // isOpen (context) is the single source of truth for whether the chat
  // should be open. visible/closing are purely local, derived state for
  // letting the collapse animation play before actually unmounting -
  // closing must go back to false once the unmount happens, otherwise the
  // panel can never render again after the very first close.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busyProposal, setBusyProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch("/hebr-animation.json")
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setClosing(false);
      return;
    }

    if (!visible) return;

    // panel is still mounted here (visible hasn't flipped false yet) -
    // tell the running blob loop to start springing back toward the
    // octopus's origin instead of its open, screen-filling target.
    blobControlRef.current?.startClose();

    setClosing(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The blob itself: a procedurally generated ink shape (solid center +
  // thin rays + scattered droplets), driven by a per-point spring system
  // - same rAF-tick-loop technique as OctopusMascot.jsx, just applied to
  // N outline points instead of one X/Y pair. Grows from `origin` (the
  // octopus's on-screen position) out to a large centered shape, keeps
  // wobbling and reacting to the pointer while open, and shrinks back
  // into `origin` on close (see blobControlRef.current.startClose above).
  useEffect(() => {
    if (!visible) return;
    if (!blobPathRef.current) return;

    const anchor = origin ?? fallbackOrigin();

    // One-time "recipe" for this open - irregular per-point radius
    // ratios, ray placement/length, droplet scatter - regenerated fresh
    // every time the chat opens so it never looks identical twice.
    const baseRatios = Array.from({ length: BLOB_POINTS }, () => 0.8 + Math.random() * 0.4);
    const rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
      anchorIndex: Math.round((i * BLOB_POINTS) / RAY_COUNT) % BLOB_POINTS,
      length: 26 + Math.random() * 60,
      width: 6 + Math.random() * 10,
      bend: (Math.random() - 0.5) * 0.6,
    }));
    const droplets = Array.from({ length: DROPLET_COUNT }, () => {
      const distanceRatio = 1.15 + Math.random() * 0.85;
      return {
        angle: Math.random() * Math.PI * 2,
        distanceRatio,
        size: Math.max(3, 14 * (1 / distanceRatio)),
        phase: Math.random() * 100,
        color: INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)],
      };
    });

    const curRadii = baseRatios.map(() => 0);
    const velRadii = baseRatios.map(() => 0);
    const curCenter = { x: anchor.x, y: anchor.y };
    const velCenter = { x: 0, y: 0 };
    let pointerPos: Point | null = null;
    let idlePhase = Math.random() * 100;
    let closingNow = false;
    let raf: number;

    // Elliptical, not circular - fills ~84% of viewport width and ~80%
    // of viewport height regardless of aspect ratio (portrait mobile vs
    // landscape desktop), by scaling a "unit" blob independently on each
    // axis instead of using one radius for both.
    function targetCenter(): Point {
      if (closingNow) return anchor;
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    function refRadius() {
      return Math.min(window.innerWidth, window.innerHeight) * 0.34;
    }
    function axisScale() {
      const ref = refRadius();
      return {
        x: (window.innerWidth * 0.42) / ref,
        y: (window.innerHeight * 0.4) / ref,
      };
    }

    const handlePointerMove = (e: PointerEvent) => {
      pointerPos = { x: e.clientX, y: e.clientY };
    };
    const clearPointer = () => {
      pointerPos = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", clearPointer);
    window.addEventListener("pointercancel", clearPointer);

    function tick() {
      idlePhase += 0.02;
      const radius = refRadius();
      const scale = axisScale();
      const tc = targetCenter();
      // Declare-then-assign, not destructuring assignment straight into
      // curCenter.x/velCenter.x - array-destructuring assignment INTO an
      // object property (as opposed to a plain variable) is what
      // production's minifier mishandled, see the commit message for the
      // "Invalid destructuring assignment target" incident this fixes.
      const [nextCenterX, nextVelCenterX] = springStep(curCenter.x, velCenter.x, tc.x, CENTER_STIFFNESS, CENTER_DAMPING);
      curCenter.x = nextCenterX;
      velCenter.x = nextVelCenterX;
      const [nextCenterY, nextVelCenterY] = springStep(curCenter.y, velCenter.y, tc.y, CENTER_STIFFNESS, CENTER_DAMPING);
      curCenter.y = nextCenterY;
      velCenter.y = nextVelCenterY;

      const collapse = closingNow ? 0 : 1;

      let pointerAngle = 0;
      let pointerFactor = 0;
      if (pointerPos && !closingNow) {
        const dx = pointerPos.x - curCenter.x;
        const dy = pointerPos.y - curCenter.y;
        pointerAngle = Math.atan2(dy, dx);
        pointerFactor = Math.max(0, 1 - Math.hypot(dx, dy) / POINTER_RANGE);
      }

      // Must match the content wrapper's own CSS max-size below
      // (min(520px, 80vw) / min(640px, 64vh)) - this is the worst-case
      // (largest possible) footprint the content could ever occupy, used
      // to guarantee every blob point stays big enough to clear it.
      const contentHalfW = Math.min(520, window.innerWidth * 0.8) / 2;
      const contentHalfH = Math.min(640, window.innerHeight * 0.64) / 2;

      const points: Point[] = [];
      for (let i = 0; i < BLOB_POINTS; i++) {
        const angle = (i / BLOB_POINTS) * Math.PI * 2;
        const idle = Math.sin(idlePhase * 0.6 + i * 0.9) * IDLE_WOBBLE * radius;
        const alignment = Math.cos(angle - pointerAngle);
        const pull = alignment * pointerFactor * POINTER_PULL * radius;
        const naturalTarget = radius * baseRatios[i] + idle + pull;

        // Hard floor, not a hope: convert "how far this point must reach
        // on screen to clear the content rectangle (+ safety margin) in
        // this direction" back into this point's own pre-axis-scale unit
        // radius, and never let the spring's target fall below it. This
        // is what actually guarantees the safe-clip (derived from these
        // same points, inset by SAFE_MARGIN_PX) always contains the
        // content - the previous version only inset from wherever the
        // edge happened to be, which could itself be too small.
        const reqScreenR = rectClearanceRadius(angle, contentHalfW + SAFE_MARGIN_PX, contentHalfH + SAFE_MARGIN_PX);
        const axisD = Math.hypot(Math.cos(angle) * scale.x, Math.sin(angle) * scale.y);
        const unitFloor = axisD > 1e-6 ? reqScreenR / axisD : 0;

        const target = Math.max(naturalTarget, unitFloor) * collapse;

        // Same declare-then-assign fix as curCenter above - curRadii[i]
        // is a computed member expression too.
        const [nextRadius, nextVel] = springStep(curRadii[i], velRadii[i], target, RADIUS_STIFFNESS, RADIUS_DAMPING);
        curRadii[i] = nextRadius;
        velRadii[i] = nextVel;
        const r = Math.max(0, curRadii[i]);
        points.push({
          x: curCenter.x + Math.cos(angle) * r * scale.x,
          y: curCenter.y + Math.sin(angle) * r * scale.y,
        });
      }

      blobPathRef.current?.setAttribute("d", catmullRomPath(points));

      // The content clip - the same outline, each point pulled back
      // toward the center by a fixed margin, so it's always a guaranteed
      // safe distance inside the real (jagged, moving) edge. Not a
      // separate visible shape - just a clip boundary content can never
      // cross, so no card/background is needed to protect it.
      const safePoints = points.map((p) => {
        const dx = p.x - curCenter.x;
        const dy = p.y - curCenter.y;
        const dist = Math.hypot(dx, dy);
        const safeDist = Math.max(0, dist - SAFE_MARGIN_PX);
        const ratio = dist > 0 ? safeDist / dist : 0;
        return {
          x: curCenter.x + dx * ratio,
          y: curCenter.y + dy * ratio,
        };
      });
      safeClipPathRef.current?.setAttribute("d", catmullRomPath(safePoints));

      rays.forEach((ray, j) => {
        const el = rayRefs.current[j];
        if (!el) return;
        const angle = (ray.anchorIndex / BLOB_POINTS) * Math.PI * 2;
        const baseR = Math.max(0, curRadii[ray.anchorIndex]);
        const tipR = baseR + ray.length * collapse;
        const perp = angle + Math.PI / 2;
        const tipAngle = angle + ray.bend;

        const baseCx = curCenter.x + Math.cos(angle) * baseR * 0.88 * scale.x;
        const baseCy = curCenter.y + Math.sin(angle) * baseR * 0.88 * scale.y;
        const tipX = curCenter.x + Math.cos(tipAngle) * tipR * scale.x;
        const tipY = curCenter.y + Math.sin(tipAngle) * tipR * scale.y;
        const halfW = (ray.width / 2) * collapse;
        const baseLx = baseCx + Math.cos(perp) * halfW;
        const baseLy = baseCy + Math.sin(perp) * halfW;
        const baseRx = baseCx - Math.cos(perp) * halfW;
        const baseRy = baseCy - Math.sin(perp) * halfW;
        const midX = (baseCx + tipX) / 2 + Math.cos(perp) * ray.length * 0.15;
        const midY = (baseCy + tipY) / 2 + Math.sin(perp) * ray.length * 0.15;

        el.setAttribute(
          "d",
          `M ${baseLx} ${baseLy} Q ${midX} ${midY} ${tipX} ${tipY} Q ${midX} ${midY} ${baseRx} ${baseRy} Z`
        );
      });

      droplets.forEach((drop, j) => {
        const el = dropletRefs.current[j];
        if (!el) return;
        const bob = Math.sin(idlePhase * 0.8 + drop.phase) * 2;
        const dist = radius * drop.distanceRatio * collapse;
        el.setAttribute("cx", `${curCenter.x + Math.cos(drop.angle) * dist * scale.x}`);
        el.setAttribute("cy", `${curCenter.y + Math.sin(drop.angle) * dist * scale.y + bob}`);
        el.setAttribute("r", `${Math.max(0, drop.size * collapse)}`);
      });

      raf = requestAnimationFrame(tick);
    }
    tick();

    blobControlRef.current = {
      startClose: () => {
        closingNow = true;
      },
    };

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearPointer);
      window.removeEventListener("pointercancel", clearPointer);
      cancelAnimationFrame(raf);
      blobControlRef.current = null;
    };
  }, [visible, origin]);

  function handleClose() {
    close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("لازم تسجّل الدخول الأول");
      }

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
          link: data.link,
          proposal: data.proposal,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء التواصل مع المساعد";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProposalDecision(
    index: number,
    decision: "execute" | "cancel"
  ) {
    const proposal = messages[index].proposal;
    if (!proposal) return;

    setBusyProposal(proposal.actionId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("لازم تسجّل الدخول الأول");

      const res = await fetch("/api/assistant/execute", {
        method: decision === "execute" ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ actionId: proposal.actionId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "تعذر التنفيذ");

      setMessages((prev) =>
        prev.map((message, i) =>
          i === index
            ? {
                ...message,
                proposalResolved:
                  decision === "execute" ? "executed" : "cancelled",
                proposalMessage: data.message,
              }
            : message
        )
      );
    } catch (err) {
      const text = err instanceof Error ? err.message : "تعذر التنفيذ";

      setMessages((prev) =>
        prev.map((message, i) =>
          i === index
            ? { ...message, proposalResolved: "failed", proposalMessage: text }
            : message
        )
      );
    } finally {
      setBusyProposal(null);
    }
  }

  function handleLinkDecision(
    index: number,
    decision: "confirmed" | "dismissed"
  ) {
    setMessages((prev) =>
      prev.map((message, i) =>
        i === index ? { ...message, linkResolved: decision } : message
      )
    );

    if (decision === "confirmed") {
      const path = messages[index].link?.path;
      if (path) router.push(path);
    }
  }

  // Same protection as before: rendered globally now (the mascot that
  // opens it lives on every page), but must never mount its interactive
  // UI for anyone but the business owner - the real enforcement is
  // server-side in app/api/assistant/route.ts, this is defense in depth
  // matching the existing pattern of not even showing the trigger.
  if (!user || user.role !== "owner") return null;

  if (!visible) return null;

  return (
    <>
      {/* The ink blob itself: decorative, fixed over the whole viewport,
          behind the actual content (z-50 vs the content's z-51). Purely
          visual - pointer-events stay off so it never blocks real taps,
          even though it reacts to pointer position. */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="print:hidden"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        <defs>
          {/* Lighter in the middle, darker at the rim - gives the main
              blob some depth instead of reading as one flat silhouette,
              on top of already being lighter than the page background. */}
          <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={BLOB_GRADIENT_LIGHT} />
            <stop offset="100%" stopColor={BLOB_GRADIENT_DARK} />
          </radialGradient>
          {/* Not rendered visibly - referenced by the content wrapper's
              own clip-path below so content can never cross outside a
              safe margin inside the real blob edge. userSpaceOnUse (the
              default) resolves against the clipped HTML element's own
              border box, which is why the content wrapper is a
              fixed/inset-0 div - that makes its border box the whole
              viewport, matching the raw window-pixel coordinates this
              path is already built in. */}
          <clipPath id={safeClipId}>
            <path ref={safeClipPathRef} />
          </clipPath>
        </defs>

        {Array.from({ length: DROPLET_COUNT }).map((_, i) => (
          <circle
            key={i}
            ref={(el) => {
              dropletRefs.current[i] = el;
            }}
            r={0}
            fill={INK_COLORS[i % INK_COLORS.length]}
          />
        ))}
        {Array.from({ length: RAY_COUNT }).map((_, i) => (
          <path
            key={i}
            ref={(el) => {
              rayRefs.current[i] = el;
            }}
            fill={INK_COLORS[i % INK_COLORS.length]}
          />
        ))}
        {/* The main body gets a thin glowing rim (the splash accent, low
            opacity) so its edge stays visible against the page's own
            near-black background instead of the two blending together. */}
        <path
          ref={blobPathRef}
          fill={`url(#${gradientId})`}
          stroke={BLOB_RIM_COLOR}
          strokeOpacity={0.4}
          strokeWidth={2.5}
        />
      </svg>

      {/* The actual chat UI - no background, no border, no shadow of its
          own. The ink blob rendered above is the only backdrop; this is
          clipped (via safeClipId, generated in the tick loop above) to a
          margin safely inside the live blob edge so content can never
          drift outside the ink, without needing a separate card to
          protect it. This wrapper has to stay fixed/inset-0 (full
          viewport, origin at 0,0) so its border box lines up with the
          raw window-pixel coordinates the clip path is built in - see
          the comment on the <clipPath> def above. */}
      <div
        className="fixed inset-0 z-[51] flex items-center justify-center p-4 print:hidden"
        style={{ pointerEvents: "none", clipPath: `url(#${safeClipId})` }}
      >
        <div
          // overflow-hidden here is a layout constraint (keeps the flex
          // children from growing past maxHeight and pushing the header
          // out of reach on a long conversation), not a visual card - no
          // background/border/shadow, so it doesn't bring back the
          // "boxed" look that was removed earlier.
          className="pointer-events-auto flex w-full flex-col overflow-hidden"
          style={{
            maxWidth: "min(520px, 80vw)",
            maxHeight: "min(640px, 64vh)",
            opacity: closing ? 0 : 1,
            transition: closing ? "opacity 200ms ease" : "opacity 350ms ease 200ms",
          }}
        >
          <div className="flex flex-none items-center border-b border-ink-600 p-5">
            <h2 className="flex items-center gap-2 font-bold">
              {animationData ? (
                <Lottie
                  animationData={animationData}
                  loop
                  autoplay
                  style={{ width: 40, height: 40 }}
                />
              ) : (
                <img
                  src="/hebr-final-1.jpg"
                  alt="حبر"
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              اسأل الأخطبوط
            </h2>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-mist">
                اسألني أي حاجة عن بيزنسك، زي &quot;قد إيه مبيعاتي النهاردة؟&quot;
              </p>
            )}

            {messages.map((message, i) => (
              <div key={i}>
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 text-right text-sm ${
                      message.role === "user"
                        ? "bg-splash text-ink-950"
                        : "bg-ink-700 text-paper"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>

                {message.link && !message.linkResolved && (
                  <div className="mt-2 max-w-[85%] space-y-2 rounded-xl border border-splash/40 bg-splash-dim p-3">
                    <p className="text-right text-sm text-splash">
                      تحب أوديك لصفحة{" "}
                      {message.link.label.replace("روح لصفحة ", "")} دلوقتي؟
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleLinkDecision(i, "dismissed")}
                        className="rounded-lg bg-ink-700 px-3 py-1.5 text-sm font-semibold text-paper transition hover:bg-ink-600"
                      >
                        ❌ لأ، خليني هنا
                      </button>
                      <button
                        onClick={() => handleLinkDecision(i, "confirmed")}
                        className="rounded-lg bg-splash px-3 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep"
                      >
                        ✅ آه وديني
                      </button>
                    </div>
                  </div>
                )}

                {message.link && message.linkResolved === "dismissed" && (
                  <p className="mt-1 text-sm text-mist">
                    تمام، خليه هنا 👍
                  </p>
                )}

                {message.proposal && !message.proposalResolved && (
                  <div className="mt-2 max-w-[85%] space-y-2 rounded-xl border border-amber-600/50 bg-amber-950/30 p-3">
                    <p className="text-right text-xs text-amber-300">
                      لسه مفيش حاجة اتغيرت. لو دوست "نفّذ" هيحصل التالي:
                    </p>

                    <p className="text-right text-sm text-paper">
                      {message.proposal.summary}
                    </p>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleProposalDecision(i, "cancel")}
                        disabled={busyProposal === message.proposal.actionId}
                        className="rounded-lg bg-ink-700 px-3 py-1.5 text-sm font-semibold text-paper transition hover:bg-ink-600 disabled:opacity-50"
                      >
                        ❌ لأ، سيبها
                      </button>

                      <button
                        onClick={() => handleProposalDecision(i, "execute")}
                        disabled={busyProposal === message.proposal.actionId}
                        className="rounded-lg bg-splash px-3 py-1.5 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
                      >
                        ✅ نفّذ
                      </button>
                    </div>
                  </div>
                )}

                {message.proposalResolved === "executed" && (
                  <p className="mt-1 text-sm text-green-400">
                    ✅ {message.proposalMessage ?? "اتنفذ"}
                  </p>
                )}

                {message.proposalResolved === "cancelled" && (
                  <p className="mt-1 text-sm text-mist">تمام، ماعملتش حاجة 👍</p>
                )}

                {message.proposalResolved === "failed" && (
                  <p className="mt-1 text-sm text-red-400">
                    ❌ {message.proposalMessage}
                  </p>
                )}
              </div>
            ))}

            {loading && <p className="text-sm text-mist">جارِ التفكير...</p>}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-none gap-2 border-t border-ink-600 p-4"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب سؤالك..."
              className="flex-1 rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper outline-none focus:border-splash"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-splash px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              ابعت
            </button>
          </form>
        </div>
      </div>

      {/* The close button lives entirely outside the clip-path system -
          not just visually separate, but structurally independent of the
          blob's geometry. Earlier this sat inside the clipped header, and
          on mobile the safe zone could momentarily shrink below what the
          header needed (window.innerHeight doesn't reliably reflect the
          visible area once the on-screen keyboard opens/closes, which
          happens constantly through a long conversation) - clipping it
          away right when it was needed most. A fixed corner position has
          no dependency on any of that: it's reachable regardless of
          screen size, keyboard state, or conversation length, by
          construction rather than by hoping the ink shape stays big
          enough. Everything else (title, messages, input) keeps living
          inside the ink as before - this is a deliberate exception for
          the one control that must never fail. */}
      <button
        onClick={handleClose}
        aria-label="إغلاق"
        className="fixed top-4 right-4 z-[52] flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/90 text-mist shadow-lg transition hover:bg-ink-700 hover:text-paper print:hidden"
        style={{
          opacity: closing ? 0 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        ✕
      </button>
    </>
  );
}
