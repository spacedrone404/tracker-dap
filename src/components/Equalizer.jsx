import React, { useEffect, useRef } from "react";
import "./Equalizer.css";

export default function Equalizer({ playerRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    let audioCtx = null;
    let sourceNode = null;
    let analyser = null;

    try {
      const p = playerRef.current;
      if (p) {
        audioCtx =
          p.audioContext ||
          p.ctx ||
          p.context ||
          (p.getAudioContext && p.getAudioContext());
        sourceNode = p.gain || (p.getOutputNode && p.getOutputNode()) || null;
      }
    } catch (e) {}

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (audioCtx && sourceNode) {
      try {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        try {
          sourceNode.disconnect(audioCtx.destination);
          sourceNode.connect(analyser);
          analyser.connect(audioCtx.destination);
        } catch (e) {
          sourceNode.connect(analyser);
        }
        analyserRef.current = analyser;
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      } catch (e) {
        dataArrayRef.current = new Uint8Array(32);
      }
    } else {
      dataArrayRef.current = new Uint8Array(32);
    }

    const draw = () => {
      if (!ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let data = dataArrayRef.current;
      if (analyserRef.current) analyserRef.current.getByteFrequencyData(data);
      else {
        for (let i = 0; i < data.length; i++) {
          data[i] =
            20 + Math.round(235 * Math.abs(Math.sin(Date.now() / 200 + i)));
        }
      }

      // Set a scaling factor to increase bar width
      const barWidthScaleFactor = 12; // Larger scaling factor for demonstration purposes

      // Use the scaling factor to compute the bar width
      const barWidth = Math.max(
        2,
        Math.floor(barWidthScaleFactor * (width / data.length))
      );

      // Figure out how many bars will realistically fit
      const effectiveNumBars = Math.floor(canvas.width / barWidth);

      for (let i = 0; i < effectiveNumBars; i++) {
        // Fetch data point closest to the current bar index
        const index = Math.floor((data.length / effectiveNumBars) * i);
        const value = data[index] / 255;
        const barHeight = value * height;

        // Recalculate hue based on the effective number of bars
        const hue = Math.floor((i / effectiveNumBars) * 360);

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (analyserRef.current && sourceNode && audioCtx) {
        try {
          sourceNode.disconnect(analyserRef.current);
          analyserRef.current.disconnect(audioCtx.destination);
          sourceNode.connect(audioCtx.destination);
        } catch (e) {}
      }
    };
  }, [playerRef]);

  return (
    <div className="equalizer" title="EQ! ♪♯♫ How cool is that?">
      <canvas ref={canvasRef} width={120} height={40} />
    </div>
  );
}
