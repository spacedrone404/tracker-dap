import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import "../App.css";
import "./PowerSwitch.css";

/* PowerSwitch
Exposes `trigger()` via ref so parent can programmatically activate it.
 */

function PowerSwitchInner(props, ref) {
  //Deploy path helper on resources like Github
  const PUBLIC_URL = process.env.PUBLIC_URL || "";

  const audioHover = new Audio(PUBLIC_URL + "/Audio/hover.mp3");
  audioHover.volume = 0.2;

  const audioRef = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [isBodyAnimating, setIsBodyAnimating] = useState(false);

  useEffect(() => {
    if (pressed) {
      setIsBodyAnimating(true);
    }
  }, [pressed]);

  useEffect(() => {
    document.body.style.transition = "all 4.4s cubic-bezier(.4,.4,.23,1)";
    if (isBodyAnimating) {
      document.body.style.opacity = "0";
      document.body.style.overflow = "hidden";
      document.body.style.backdropFilter = "blur(28px)";
    } else {
      document.body.style.opacity = "";
      document.body.style.backdropFilter = "";
      document.body.style.overflow = "";
    }
  }, [isBodyAnimating]);

  if (!audioRef.current) {
    audioRef.current = new Audio(PUBLIC_URL + "/Audio/on-off/power-off.mp3");
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1.0;
  }

  const tryCloseWindow = () => {
    try {
      window.close();
    } catch (e) {}
    try {
      window.open("", "_self")?.close?.();
    } catch (e) {}
    try {
      window.location.href = "about:blank";
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {}
      }, 384);
    } catch (e) {}
  };

  const continueAfterSound = () => {
    try {
      window.open("https://google.com", "_blank", "noopener,noreferrer");
    } catch (e) {}
    tryCloseWindow();
  };

  // main click handler
  const handleClick = async () => {
    if (pressed) return;
    setPressed(true);

    const audio = audioRef.current;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}

    try {
      await audio.play();
    } catch (e) {}

    // ensure body animation resets after ~2s
    setTimeout(() => {
      setIsBodyAnimating(false);
    }, 4800);

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

    // fallback timeout
    setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        audio.removeEventListener("ended", onEnded);
      } catch (e) {}
      continueAfterSound();
    }, 4800);
  };

  // expose trigger() to parent
  useImperativeHandle(
    ref,
    () => ({
      trigger: () => {
        // call click handler programmatically
        handleClick();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
      title="Turns off tracker machine, closes page & opens web search! [ALT+Q]"
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={() => audioHover.play()}
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
        zIndex: 40000,
        width: 96,
        cursor: pressed ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      <div style={{ position: "relative", width: "100%", display: "block" }}>
        <img
          src={PUBLIC_URL + "/Pix/power-off/power-switch-on.png"}
          alt="Power switch on"
          draggable={false}
          style={{
            ...imgCommonStyle,
            position: "relative",
            zIndex: 1,
            opacity: pressed ? 0 : 1,
            transition: "opacity 400ms ease-in-out",
          }}
        />
        <img
          src={PUBLIC_URL + "/Pix/power-off/power-switch-off.png"}
          alt="Power switch off"
          draggable={false}
          style={{
            ...imgCommonStyle,
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 2,
            opacity: pressed ? 1 : 0,
            transition: "opacity 400ms ease-in-out",
          }}
        />
      </div>
    </div>
  );
}

export default forwardRef(PowerSwitchInner);
