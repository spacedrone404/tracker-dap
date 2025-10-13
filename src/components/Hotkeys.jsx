// src/components/Hotkeys.jsx
import { useEffect } from "react";

export default function Hotkeys({
  onPlayPause,
  onPrev,
  onNext,
  onShuffle,
  onLoop,
  onVolumeUp,
  onVolumeDown,
}) {
  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!target) return false;
      const tag = (target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select")
        return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const handler = (e) => {
      // ignore repeats (holding the key)
      if (e.repeat) return;

      // ignore when user uses modifier keys (Ctrl/Alt/Meta) — reduces accidental conflicts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // ignore when focus is in an editable element
      if (isEditableTarget(e.target)) return;

      const code = e.code || "";
      const key = e.key || "";

      // SPACE: play/pause
      if (code === "Space" || key === " " || key === "Spacebar") {
        if (typeof onPlayPause === "function") {
          e.preventDefault();
          onPlayPause();
        }
        return;
      }

      // Left Arrow: previous
      if (code === "ArrowLeft" || key === "ArrowLeft") {
        if (typeof onPrev === "function") {
          e.preventDefault();
          onPrev();
        }
        return;
      }

      // Right Arrow: next
      if (code === "ArrowRight" || key === "ArrowRight") {
        if (typeof onNext === "function") {
          e.preventDefault();
          onNext();
        }
        return;
      }

      // F10: shuffle toggle
      if (code === "F10" || key === "F10") {
        if (typeof onShuffle === "function") {
          try {
            e.preventDefault();
          } catch {}
          onShuffle();
        }
        return;
      }

      // F11: loop toggle (may be intercepted by browser fullscreen)
      if (code === "F11" || key === "F11") {
        if (typeof onLoop === "function") {
          try {
            e.preventDefault();
          } catch {}
          onLoop();
        }
        return;
      }

      // Volume Up/Down

      if (code === "ArrowUp" || key === "ArrowUp") {
        if (typeof onVolumeUp === "function") {
          try {
            e.preventDefault();
          } catch {}
          onVolumeUp();
        }
        return;
      }
      if (code === "ArrowDown" || key === "ArrowDown") {
        if (typeof onVolumeDown === "function") {
          try {
            e.preventDefault();
          } catch {}
          onVolumeDown();
        }
        return;
      }
    };

    window.addEventListener("keydown", handler, { passive: false });
    return () => {
      window.removeEventListener("keydown", handler, { passive: false });
    };
  }, [
    onPlayPause,
    onPrev,
    onNext,
    onShuffle,
    onLoop,
    onVolumeUp,
    onVolumeDown,
  ]);

  return null;
}
