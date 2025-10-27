import React from "react";
import "./buttons";

const PlayIcon = () => (
  <svg
    className="correction360px"
    viewBox="-0.5 0 8 8"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      id="Page-1"
      stroke="none"
      stroke-width="1"
      fill="none"
      fill-rule="evenodd"
    >
      <g
        id="Dribbble-Light-Preview"
        transform="translate(-427.000000, -3765.000000)"
        fill="#000000"
      >
        <g id="icons" transform="translate(56.000000, 160.000000)">
          <polygon
            id="play-[#1001]"
            points="371 3605 371 3613 378 3609"
          ></polygon>
        </g>
      </g>
    </g>
  </svg>
);

const PauseIcon = () => (
  <svg
    className="correction360px"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7 1H2V15H7V1Z" fill="#000000" />
    <path d="M14 1H9V15H14V1Z" fill="#000000" />
  </svg>
);

// Shuffle Icon (Off state)
const ShuffleOffIcon = () => (
  <svg
    className="correction360px"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="Layer_2" data-name="Layer 2">
      <g id="invisible_box" data-name="invisible box">
        <rect width="48" height="48" fill="none" />
      </g>
      <g id="Q3_icons" data-name="Q3 icons">
        <g>
          <path d="M42,22H6a2,2,0,0,0,0,4H42a2,2,0,0,0,0-4Z" />
          <path d="M6,18H42a2,2,0,0,0,0-4H6a2,2,0,0,0,0,4Z" />
          <path d="M42,30H6a2,2,0,0,0,0,4H42a2,2,0,0,0,0-4Z" />
          <polygon points="24 4 18 10 30 10 24 4" />
          <polygon points="24 44 30 38 18 38 24 44" />
        </g>
      </g>
    </g>
  </svg>
);

// Shuffle Icon (On state)
const ShuffleOnIcon = () => (
  <svg
    className="correction360px"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 1H12V3H10.5858L7 6.58579L3.41421 3H0V5H2.58579L5.58579 8L2.58579 11H0V13H3.41421L11.4142 5H12V7H13L16 4L13 1Z"
      fill="#000000"
    />
    <path
      d="M12 9H13L16 12L13 15H12V13H10.5858L8.41421 10.8284L9.82843 9.41421L11.4142 11H12V9Z"
      fill="#000000"
    />
  </svg>
);

// Loop Icon (Off state)
const LoopOffIcon = () => (
  <svg
    className="correction360px"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M16 1V15H9V13H14V3H9V1L16 1Z" fill="#000000" />
    <path d="M6 4V7L8.74229e-08 7L0 9H6V12H7L11 8L7 4H6Z" fill="#000000" />
  </svg>
);

// Loop Icon (On state)
const LoopOnIcon = () => (
  <svg
    className="correction360px"
    fill="#000000"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 7v7c0 1.103-.896 2-2 2H2c-1.104 0-2-.897-2-2V7a2 2 0 0 1 2-2h7V3l4 3.5L9 10V8H3v5h14V8h-3V5h4a2 2 0 0 1 2 2z" />
  </svg>
);

// Rewind Button Icon
const RewindIcon = () => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <path d="M25,6v20L13,16L25,6z M7,16l12,10v-3.698L11.438,16L19,9.698V6L7,16z" />
  </svg>
);

// Fast Forward Button Icon
const FastForwardIcon = () => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <path d="M19,16L7,26V6L19,16z M13,6v3.698L20.562,16L13,22.302V26l12-10L13,6z" />
  </svg>
);

export {
  PlayIcon,
  PauseIcon,
  RewindIcon,
  FastForwardIcon,
  ShuffleOffIcon,
  ShuffleOnIcon,
  LoopOffIcon,
  LoopOnIcon,
};
