import { useEffect } from "react";

export default function BackdropPicker() {
  //Deploy path helper on resources like Github
  const PUBLIC_URL = process.env.PUBLIC_URL || "";

  useEffect(() => {
    if (typeof document === "undefined") return;

    const randomNumber = Math.random();

    let chosen;
    if (randomNumber < 0.33) {
      chosen = PUBLIC_URL + "/Pix/backdrops/backdrop-1.png";
    } else if (randomNumber >= 0.15 && randomNumber < 0.3) {
      chosen = PUBLIC_URL + "/Pix/backdrops/backdrop-2.png";
    } else if (randomNumber >= 0.3 && randomNumber < 0.6) {
      chosen = PUBLIC_URL + "/Pix/backdrops/backdrop-3.png";
    } else {
      chosen = PUBLIC_URL + "/Pix/backdrops/backdrop-4.png";
    }

    document.documentElement.style.setProperty(
      "--backdrop-url",
      `url("${chosen}")`
    );
  }, []);

  return null;
}
