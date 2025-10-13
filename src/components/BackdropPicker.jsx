import { useEffect } from "react";

export default function BackdropPicker() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const randomNumber = Math.random();

    let chosen;
    if (randomNumber < 0.33) {
      chosen = "/Pix/backdrops/backdrop-1.png";
    } else if (randomNumber >= 0.33 && randomNumber < 0.66) {
      chosen = "/Pix/backdrops/backdrop-2.png";
    } else {
      chosen = "/Pix/backdrops/backdrop-3.png";
    }

    document.documentElement.style.setProperty(
      "--backdrop-url",
      `url("${chosen}")`
    );
  }, []);

  return null;
}

// export default function BackdropPicker() {
//   useEffect(() => {
//     if (typeof document === "undefined") return;
//     const chosen =
//       Math.random() < 0.5
//         ? "/Pix/backdrops/backdrop1.png"
//         : "/Pix/backdrops/backdrop2.png";
//     document.documentElement.style.setProperty(
//       "--backdrop-url",
//       `url("${chosen}")`
//     );
//   }, []);

//   return null;
// }
