import React from "react";
import "./StarAnimation.css";

const StarAnimation = () => {
  const animateStars = () => {
    const stars = document.querySelectorAll(".star");
    const starsMiddle = document.querySelectorAll(".star-middle");
    const starsSmall = document.querySelectorAll(".star-small");

    stars.forEach((star) => {
      const delay = Math.random() * 1.8;
      star.style.animationDelay = `${delay}s`;
      star.style.animationDuration = `${2 + Math.random()}s`;
    });

    starsMiddle.forEach((star) => {
      const delay = Math.random() * 1.9;
      star.style.animationDelay = `${delay}s`;
      star.style.animationDuration = `${1.8 + Math.random()}s`;
    });

    starsSmall.forEach((star) => {
      const delay = Math.random() * 2;
      star.style.animationDelay = `${delay}s`;
      star.style.animationDuration = `${1.9 + Math.random()}s`;
    });
  };

  const addMovingStars = () => {
    const starContainer = document.querySelector(".space");
    const numberOfStars = 8;

    for (let i = 0; i < numberOfStars; i++) {
      const star = document.createElement("div");
      star.classList.add("star-moving");
      star.style.left = Math.random() * 100 + "vw";

      star.style.animationDuration = 14 + Math.random() * 14 + "s";
      star.style.animationDelay = Math.random() * 14 + "s";
      starContainer.appendChild(star);
    }
  };

  React.useEffect(() => {
    animateStars();
    addMovingStars();
  }, []);

  return (
    <>
      <div className="space">
        <div className="stars"></div>
        <div className="stars middle"></div>
        <div className="stars small"></div>
      </div>
    </>
  );
};

export default StarAnimation;
