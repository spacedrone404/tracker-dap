import React, { useEffect, useRef, useState } from "react";
import "./ScrollTop.css";

const PUBLIC_URL = process.env.PUBLIC_URL || "";

const audioHover = new Audio(PUBLIC_URL + "/Audio/hover.mp3");
const audioClick = new Audio(PUBLIC_URL + "/Audio/scroll.mp3");

audioHover.volume = 0.2;

const ScrollTop = () => {
  const [showButton, setShowButton] = useState(false);
  const [animate, setAnimate] = useState(false);
  const buttonRef = useRef(null);

  const handleScroll = () => {
    if (window.scrollY > 48) {
      setTimeout(() => setShowButton(true), 800);
    } else {
      setAnimate(false);
      setTimeout(() => setShowButton(false), 800);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (showButton) {
      setTimeout(() => setAnimate(true), 224);
    }
  }, [showButton]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    audioClick.play();
  };

  return (
    <>
      {showButton && (
        <button
          ref={buttonRef}
          className={`scroll-to-top ${animate ? "visible" : "hidden"}`}
          onClick={scrollToTop}
          onMouseEnter={() => audioHover.play()}
          title="Rewind me to TOP"
        >
          ▲
        </button>
      )}
    </>
  );
};

export default ScrollTop;
