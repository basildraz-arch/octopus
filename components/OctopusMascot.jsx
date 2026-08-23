"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";

import { subscribeMascotMood } from "@/lib/mascotMood";
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

// ---- The eyes ----
//
// The mascot used to be a bought animation file that blinked and looked
// around, and losing that made him read as a sticker instead of a
// creature. Rather than buy another one or generate a new drawing (which
// would not be the same octopus), the drawing we own is split into
// layers - body with blank eye-whites, a pupil, and a closed-eye frame -
// and the life is put back with code. tools/make_rig.py builds them.
//
// Positions are fractions of the 768px artwork, measured from it, so
// they hold at any rendered size.
const PUPIL_AT = {
  L: { x: 295 / 768, y: 374 / 768 },
  R: { x: 474 / 768, y: 374 / 768 },
};
const PUPIL_SIZE = 91 / 768;
// How far a pupil may slide inside the eye-white before it would clip
// through the edge. The eyeball is 69x58 and the pupil radius 35, so
// this is deliberately short of that.
const PUPIL_TRAVEL_X = 18 / 768;
const PUPIL_TRAVEL_Y = 11 / 768;

// ---- المشاعر ----
//
// كل شعور صورة كاملة متحاذية على نفس الإطار (tools/mood_from_render.py).
//
// جرّبنا الأول نطلّع الوش كطبقة شفافة فوق الرِّج، عشان حبر يفضل يرمش
// وعينه تتبع الماوس وهو بيعبّر. الفكرة سليمة والمحاذاة اشتغلت (فرق
// أقل من 1%)، بس النتيجة كانت وحشة: تظليل الرأس في الرسمة المولّدة
// مختلف عن الأصل، فحدود القص كانت بتبان كرقعة أفتح على وشه. القياس
// مامسكش ده - الصورة بالحجم الكامل هي اللي كشفته.
//
// فالتعبير بقى صورة كاملة، والثمن إن الرمشة وتتبّع النظرة بيقفوا
// ثانيتين وقت التعبير. الطوفان والميل والنَفَس والنطة بيفضلوا شغالين
// لأنهم على العنصر الحاوي مش على الصورة - فهو لسه عايش وهو بيعبّر،
// بس عينه ثابتة.
const MOOD_NAMES = ["happy", "sad", "surprised", "scared", "angry"];
// التبديل بتلاشي - القطع المفاجئ بيبان زي الغلطة.
const MOOD_FADE_MS = 190;

// A blink is three drawings, not an on/off switch. Swapping straight
// between open and shut reads as a glitch - a frame of half-closed on
// the way down and again on the way up is what makes it read as an
// eyelid. It also closes faster than it opens, like a real one.
const BLINK_CLOSE_MS = 30;
const BLINK_HOLD_MS = 55;
const BLINK_OPEN_MS = 45;
const BLINK_MIN_GAP_MS = 2200;
const BLINK_MAX_GAP_MS = 6000;
const DOUBLE_BLINK_CHANCE = 0.22;
// People very often blink as their eyes land somewhere new, so a glance
// sometimes drags a blink along with it.
const BLINK_AFTER_GLANCE_CHANCE = 0.35;
// After this long without the pointer, he stops staring at it and starts
// glancing around on his own.
const GAZE_IDLE_AFTER_MS = 1200;

// Every full-size layer sits in exactly the same box, so they stay
// registered with each other whatever size he is rendered at.
const layerStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "contain",
  userSelect: "none",
  WebkitUserDrag: "none",
};

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
 * layers motion on top of a single still drawing:
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
  size = 96,
  className = "",
}) {
  const outerRef = useRef(null);
  const wrapRef = useRef(null);
  const inkLayerRef = useRef(null);
  const pupilLRef = useRef(null);
  const pupilRRef = useRef(null);
  const lidHalfRef = useRef(null);
  const lidShutRef = useRef(null);
  const [mood, setMood] = useState("neutral");
  // الحلقة بتشتغل مرة واحدة وبتفضل شغالة، فلو قرت mood من الـstate
  // هتفضل شايفة أول قيمة للأبد. الـref بتتحدّث من غير ما تعيد الحلقة.
  const moodRef = useRef("neutral");
  const filterId = `octopus-ink-goo-${useId().replace(/:/g, "")}`;
  const [effectiveSize, setEffectiveSize] = useState(size);
  const { user } = useSession();
  const { open: openAssistantChat } = useAssistantChat();

  // حبر متركّب مرة واحدة فوق الراوتر، فالصفحات مابتقدرش تمرّرله props.
  // بيسمع على القناة بدل كده (lib/mascotMood.ts).
  useEffect(
    () =>
      subscribeMascotMood((next) => {
        moodRef.current = next;
        setMood(next);

        // نطة صغيرة مع تغيير المزاج - التعبير من غير حركة جسم بيبان
        // زي ما الوش اتبدّل، مش زي ما هو حسّ بحاجة.
        if (next !== "neutral") wrapRef.current?.__setBounce?.(0.3);
      }),
    []
  );

  // Smaller footprint on narrow screens - a 120px mascot is a big chunk
  // of a ~390px-wide phone screen.
  useEffect(() => {
    function updateSize() {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setEffectiveSize(mobile ? Math.min(size, 70) : size);
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [size]);

  // Wandering + pointer-follow tilt + idle sway + eye tracking, all driven
  // by one shared animation loop so they compose into transforms on two
  // nested elements instead of fighting each other:
  //   outerRef  (fixed, viewport position) <- wander target
  //   wrapRef   (relative, inside outer)   <- tilt/idle/bounce
  useEffect(() => {
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

    // --- the eyes ---
    // Read through the refs each time rather than captured once, so this
    // effect does not have to re-run (and re-place him from scratch)
    // whenever the layers are swapped for a mood frame.
    let gazeTargetX = 0,
      gazeTargetY = 0,
      gazeX = 0,
      gazeY = 0,
      gazeVelX = 0,
      gazeVelY = 0,
      lastPointerAt = 0;

    // Every timer here has to be collected, not just the last one: a
    // double blink schedules a nested one, and a component unmounted
    // mid-blink would otherwise touch a detached node.
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };

    function doBlink(after) {
      // مافيش رمشة وهو بيعبّر: صورة التعبير فيها العين مرسومة، فطبقة
      // الجفن هتنزل على وش تاني وتبان زي الغلطة.
      if (moodRef.current !== "neutral") return;

      const half = lidHalfRef.current;
      const shut = lidShutRef.current;
      if (!half || !shut) return;

      half.style.opacity = "1";
      later(() => {
        half.style.opacity = "0";
        shut.style.opacity = "1";
        later(() => {
          shut.style.opacity = "0";
          half.style.opacity = "1";
          later(() => {
            half.style.opacity = "0";
            after?.();
          }, BLINK_OPEN_MS);
        }, BLINK_HOLD_MS);
      }, BLINK_CLOSE_MS);
    }

    function scheduleBlink() {
      later(() => {
        doBlink(() => {
          // People rarely blink once. The occasional double is most of
          // what makes it read as breathing rather than a timer.
          if (Math.random() < DOUBLE_BLINK_CHANCE) later(doBlink, 150);
        });
        scheduleBlink();
      }, BLINK_MIN_GAP_MS + Math.random() * (BLINK_MAX_GAP_MS - BLINK_MIN_GAP_MS));
    }

    function scheduleGlance() {
      later(() => {
        if (
          pupilLRef.current &&
          Date.now() - lastPointerAt > GAZE_IDLE_AFTER_MS
        ) {
          gazeTargetX = (Math.random() * 2 - 1) * 0.8;
          gazeTargetY = (Math.random() * 2 - 1) * 0.6;

          if (Math.random() < BLINK_AFTER_GLANCE_CHANCE) later(doBlink, 90);
        }
        scheduleGlance();
      }, 1500 + Math.random() * 2500);
    }

    // التبويب لما يتخفي، المتصفح بيوقّف requestAnimationFrame بس
    // بيسيب المؤقتات شغالة - وبيبطّئها لحد مرة كل دقيقة. يعني رمشة
    // بدأت قبل ما تبدّل التبويب ممكن تفضل "مقفولة" لدقيقة كاملة،
    // وترجع تلاقي حبر مغمّض. فبنقفل الجفون ونسكت وهو مخفي.
    const handleVisibility = () => {
      // بيتنادى في الحالتين - راح وجه. في الاتنين بنلغي المؤقتات
      // ونفتح العين، وبعدين نرجّع الجدولة لو التبويب باين.
      timers.forEach(clearTimeout);
      timers.clear();

      if (lidHalfRef.current) lidHalfRef.current.style.opacity = "0";
      if (lidShutRef.current) lidShutRef.current.style.opacity = "0";

      if (document.visibilityState === "visible") {
        scheduleBlink();
        scheduleGlance();
      }
    };

    // بيتنادى مرة على طول كمان، مش بس عند التغيير: لو الصفحة فتحت
    // في تبويب مخفي من الأساس، الحدث مابيحصلش خالص - فكان بيفضل
    // يرمش في الخلفية. اتكشفت بقياس من المتصفح: 8 فريمات رمشة
    // والتبويب hidden.
    handleVisibility();

    document.addEventListener("visibilitychange", handleVisibility);

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
      const clampedX = Math.max(-1, Math.min(1, relX));
      const clampedY = Math.max(-1, Math.min(1, relY));

      targetX = clampedX * 18;
      targetY = clampedY * 10;

      // The eyes follow further than the body tilts - he turns his head a
      // little and his eyes the rest of the way, which is what makes it
      // feel like being looked at.
      gazeTargetX = clampedX;
      gazeTargetY = clampedY;
      lastPointerAt = Date.now();
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
      // A slow breath under everything else: he swells a little and
      // narrows a little, on a cycle far slower than the bob. Small
      // enough that you would not name it if asked, which is the point -
      // holding perfectly still is what made the still image read as a
      // sticker.
      const breathe = Math.sin(idlePhase * 0.31) * 0.012;
      const scaleX = 1 + bounceOffset * BOUNCE_STRETCH_X - breathe * 0.6;
      const scaleY = 1 + bounceOffset * BOUNCE_STRETCH_Y + breathe;

      wrap.style.transform = `perspective(600px) translateY(${idleBobY}px) rotateY(${
        curX + idleTiltX
      }deg) rotateX(${-curY}deg) scale(${scaleX}, ${scaleY})`;

      const pupilL = pupilLRef.current;
      const pupilR = pupilRRef.current;
      if (pupilL && pupilR) {
        [gazeX, gazeVelX] = springStep(gazeX, gazeVelX, gazeTargetX, 0.13, 0.74);
        [gazeY, gazeVelY] = springStep(gazeY, gazeVelY, gazeTargetY, 0.13, 0.74);

        const px = gazeX * PUPIL_TRAVEL_X * effectiveSize;
        // A hair of the idle bob leaks into the eyes as well, so they
        // are not the one part of him holding perfectly still.
        const py =
          gazeY * PUPIL_TRAVEL_Y * effectiveSize + idleBobY * 0.06;

        const t = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
        pupilL.style.transform = t;
        pupilR.style.transform = t;
      }

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
      document.removeEventListener("visibilitychange", handleVisibility);

      clearTimeout(wanderTimer);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [effectiveSize]);

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

            {/* Three stacked drawings, not an animation file.
                body (blank eye-whites) -> pupils -> closed-eye frame.
                The pupils are moved and the closed-eye frame flashed by
                the loop above, which is where the blinking and the
                looking-around come from. The old file did this too, but
                it was a stock animation we had no licence to; these are
                cut from the drawing we own (tools/make_rig.py). */}
            <img
              src="/hebr/body.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              style={layerStyle}
            />

            <>
              {[
                  ["L", pupilLRef],
                  ["R", pupilRRef],
                ].map(([side, ref]) => (
                  <img
                    key={side}
                    ref={ref}
                    src="/hebr/pupil.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: `${PUPIL_AT[side].x * 100}%`,
                      top: `${PUPIL_AT[side].y * 100}%`,
                      width: `${PUPIL_SIZE * 100}%`,
                      height: `${PUPIL_SIZE * 100}%`,
                      transform: "translate(-50%, -50%)",
                      // صورة التعبير فيها عينين مرسومين، فالبؤبؤ
                      // المتحرك لازم يختفي وإلا يبقى فيه أربع عيون.
                      opacity: mood === "neutral" ? 1 : 0,
                      transition: `opacity ${MOOD_FADE_MS}ms ease`,
                      pointerEvents: "none",
                      userSelect: "none",
                      WebkitUserDrag: "none",
                    }}
                  />
                ))}

                {/* The eyelids are cut out as their own transparent
                    layers rather than whole-body frames, so at half
                    closed the pupil still shows underneath instead of
                    the eye going blank for a frame. */}
                {MOOD_NAMES.map((m) => (
                  <img
                    key={`mood-${m}`}
                    src={`/hebr/mood-${m}.png`}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{
                      ...layerStyle,
                      position: "absolute",
                      inset: 0,
                      opacity: mood === m ? 1 : 0,
                      transition: `opacity ${MOOD_FADE_MS}ms ease`,
                      pointerEvents: "none",
                    }}
                  />
                ))}

                {[
                  ["half", lidHalfRef],
                  ["shut", lidShutRef],
                ].map(([stage, ref]) => (
                  <img
                    key={stage}
                    ref={ref}
                    src={`/hebr/lid-${stage}.png`}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{
                      ...layerStyle,
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      pointerEvents: "none",
                    }}
                  />
                ))}
            </>

            <div
              ref={inkLayerRef}
              style={{
                position: "absolute",
                inset: 0,
                filter: `url(#${filterId})`,
                pointerEvents: "none",
              }}
            />
      </div>
    </div>
  );
}
