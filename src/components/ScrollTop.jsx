import React, { useEffect, useRef, useState } from "react";
import "./ScrollTop.css";

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
  };

  return (
    <>
      {showButton && (
        <button
          ref={buttonRef}
          className={`scroll-to-top ${animate ? "visible" : "hidden"}`}
          onClick={scrollToTop}
          title="Rewind me to TOP"
        >
          ▲
        </button>
      )}
    </>
  );
};

export default ScrollTop;
