// src/components/PowerSwitch.jsx
import React, { useRef, useState, useEffect } from "react";

/**
 * PowerSwitch
 * - Crossfades /pix/power-switch-on.png -> /pix/power-switch-off.png with 400ms opacity transition on click.
 * - Keeps all existing behaviour (plays /Audio/power-off.mp3, waits for end or 2s fallback,
 *   opens Google in new tab and attempts to close the current tab).
 *
 * Note: This implementation layers two <img/> elements so the visual crossfade is smooth
 * and we don't need to swap the src attribute (which cannot be animated).
 */
export default function PowerSwitch() {
  const audioRef = useRef(null);
  const [pressed, setPressed] = useState(false);

  const [isBodyAnimating, setIsBodyAnimating] = useState(false);

  useEffect(() => {
    if (pressed) {
      setIsBodyAnimating(true); // Trigger animation globally
    }
  }, [pressed]);

  // Style changes applied directly to body element
  useEffect(() => {
    document.body.style.transition = "all 1.9s cubic-bezier(.4,.4,.23,1)";

    if (isBodyAnimating) {
      document.body.style.opacity = "0";
      document.body.style.overflow = "hidden";
      document.body.style.backdropFilter = "blur(28px)";
    } else {
      document.body.style.opacity = "";
      document.body.style.backdropFilter = ""; // Reset to defaults
    }
  }, [isBodyAnimating]);

  // Lazy init audio from public folder
  if (!audioRef.current) {
    audioRef.current = new Audio("/Audio/on-off/power-off.mp3");
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1.0;
  }

  // Best-effort close sequence: several tricks tried in order.
  const tryCloseWindow = () => {
    try {
      // 1) Direct close (works only if script opened this tab)
      window.close();
    } catch (e) {}

    // 2) Special trick: replace self with same-origin blank and close
    try {
      // Some browsers allow this pattern: open empty self and close it
      // Note: this still may be blocked by most browsers
      // eslint-disable-next-line
      window.open("", "_self")?.close?.();
    } catch (e) {}

    // 3) Navigate current tab to about:blank then attempt close again after a small delay
    try {
      window.location.href = "about:blank";
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {}
      }, 150);
    } catch (e) {}

    // 4) As absolute fallback, nothing else we can do from page script due to browser security.
    // New tab to Google will already be opened by caller.
  };

  const handleClick = async () => {
    if (pressed) return;

    // start visual transition immediately
    setPressed(true);

    const audio = audioRef.current;

    // Ensure start from beginning
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}

    // Play audio (user gesture). Wait for either end event or a 2s timeout (whichever first).
    let played = false;
    try {
      // try to play; some browsers return a promise
      await audio.play();
      played = true;
    } catch (e) {
      // play may fail but we'll still proceed with the timeout fallback
      played = false;
    }

    setTimeout(() => {
      setIsBodyAnimating(false); // Resets the body back to normal
    }, 2000);

    // Helper to continue flow after audio end or timeout
    const continueAfterSound = () => {
      // 1) Open Google in a new tab/window
      try {
        // Use noopener to avoid giving opener access
        window.open("https://google.com", "_blank", "noopener,noreferrer");
      } catch (e) {
        // ignore
      }

      // 2) Attempt to close current tab using several techniques
      tryCloseWindow();
    };

    // If audio fires ended, use that event; otherwise a 2s fallback
    let finished = false;
    const onEnded = () => {
      if (finished) return;
      finished = true;
      try {
        audio.removeEventListener("ended", onEnded);
      } catch (e) {}
      continueAfterSound();
    };

    audio.addEventListener("ended", onEnded);

    // fallback timeout (in case ended doesn't fire or play failed)
    setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        audio.removeEventListener("ended", onEnded);
      } catch (e) {}
      continueAfterSound();
    }, 2000);
  };

  // shared styles used by images (kept inline to avoid changing external CSS)
  const imgCommonStyle = {
    width: "100%",
    height: "auto",
    display: "block",
    borderRadius: 6,
    boxShadow:
      "0 6px 18px rgba(0,0,0,0.6), inset 0 2px 6px rgba(255,255,255,0.05)",
    pointerEvents: "none",
    userSelect: "none",
  };

  return (
    <div
      className={`power-switch ${pressed ? "disabled" : ""}`}
      role="button"
      aria-label="Power switch"
      title="Turns off tracker machine, closes page & opens web search!"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !pressed) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        position: "fixed",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 12000,
        width: 96,
        cursor: pressed ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      {/* wrapper preserves layout; on-image is in-flow so wrapper height is naturally the image height */}
      <div style={{ position: "relative", width: "100%", display: "block" }}>
        {/* ON image: in-flow so wrapper gets height; it fades out when pressed */}
        <img
          src="/pix/power-off/power-switch-on.png"
          alt="Power switch on"
          draggable={false}
          style={{
            ...imgCommonStyle,
            position: "relative",
            zIndex: 1,
            opacity: pressed ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
          }}
        />
        {/* OFF image: absolutely positioned on top of the on-image so crossfade looks smooth */}
        <img
          src="/pix/power-off/power-switch-off.png"
          alt="Power switch off"
          draggable={false}
          style={{
            ...imgCommonStyle,
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 2,
            opacity: pressed ? 1 : 0,
            transition: "opacity 600ms ease-in-out",
          }}
        />
      </div>
    </div>
  );
}
