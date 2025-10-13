// App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChiptuneJsPlayer } from "chiptune3";
import Hotkeys from "./components/Hotkeys";
import PowerSwitch from "./components/PowerSwitch";
import BackdropPicker from "./components/BackdropPicker";
import Equalizer from "./components/Equalizer";
import "./App.css";

// Resume an AudioContext-like object if suspended (autoplay policy)
const resumeAudioContextIfNeeded = async (maybeCtx) => {
  try {
    if (!maybeCtx) return;
    const ctx =
      maybeCtx.audioContext ||
      maybeCtx.ctx ||
      maybeCtx.context ||
      (maybeCtx.getAudioContext && maybeCtx.getAudioContext());
    if (!ctx) return;
    if (typeof ctx.resume === "function" && ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch (e) {}
};

export default function App() {
  const playlists = [
    {
      name: "DEMOSCENE",
      tracks: [
        { name: "Moby - Fury Forest", url: "/Music/demoscene/furyforest.mod" },
        {
          name: "Firage - Galaxy Hero",
          url: "/Music/demoscene/galaxyhero.mod",
        },
        {
          name: "Michael - Open Your Heart",
          url: "/Music/demoscene/heart.mod",
        },
        { name: "Alien - Robocop III", url: "/Music/demoscene/robocop3.xm" },
      ],
    },
    {
      name: "GAMES",
      tracks: [
        { name: "BaseHead - Crusader", url: "/Music/games/basehead.s3m" },
        { name: "Silent Mode - Eternity", url: "/Music/games/eternity.mod" },
        {
          name: "Alexander Brandon - Jazz The Jack Rabbit",
          url: "/Music/games/jazz.s3m",
        },
        { name: "C.C.Catch - One Must Fall", url: "/Music/games/omf2097.s3m" },
      ],
    },
    {
      name: "KEYGEN",
      tracks: [
        { name: "Unknown - ST-Style", url: "/Music/keygen/flcstst.xm" },
        { name: "Dubmood - Lucid", url: "/Music/keygen/lucid.xm" },
        { name: "FLC - Stargliders", url: "/Music/keygen/stargliders.xm" },
        { name: "Unknown - Your Dreams", url: "/Music/keygen/yr-dreamz.xm" },
      ],
    },
    {
      name: "TRANCE",
      tracks: [
        { name: "Adnan - Drilling", url: "/Music/trance/driling.it" },
        { name: "Revisq - Fish, fish ... ", url: "/Music/trance/fish.mod" },
        { name: "Unknown - I'am My Slave", url: "/Music/trance/slave.xm" },
        { name: "Mobby - A Trip To Trance", url: "/Music/trance/trip.mod" },
      ],
    },
  ];

  // UI state
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(true);
  const [isLoop, setIsLoop] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showStartup, setShowStartup] = useState(true);

  // refs
  const player = useRef(null);
  const currentBufferRef = useRef(null);
  const durationRef = useRef(0);
  const progressRef = useRef(0);
  const progressIntervalRef = useRef(null);
  const clickSoundControls = useRef(new Audio("/Audio/clicks/click-1.mp3"));
  const clickSoundPlaylist = useRef(new Audio("/Audio/clicks/click-2.mp3"));
  const startupSound = useRef(new Audio("/Audio/on-off/startup.mp3"));
  const audioHover = useRef(new Audio("/Audio/side-panel/side-help-open.mp3"));
  const audioUnhover = useRef(
    new Audio("/Audio/side-panel/side-help-close.mp3")
  );

  const handleNextRef = useRef(null);
  const loadingRef = useRef(false);

  // synchronous playing ref to avoid race conditions with React state
  const isPlayingRef = useRef(false);
  // helper to update both state and ref atomically
  const setPlayingState = useCallback((v) => {
    isPlayingRef.current = v;
    setIsPlaying(v);
  }, []);

  // stable refs to avoid stale closures inside end handler
  const currentTrackIndexRef = useRef(null);
  const isShuffleRef = useRef(isShuffle);
  const isLoopRef = useRef(isLoop);
  const selectedPlaylistRef = useRef(selectedPlaylist);

  // ref for the onTrackEnd function so player.endHandler can call latest impl
  const onTrackEndRef = useRef(null);

  // store paused position when library doesn't support pause/resume properly
  const pausedPositionRef = useRef(null);

  const playClickSoundControls = () => {
    try {
      clickSoundControls.current.currentTime = 0;
      clickSoundControls.current.play();
    } catch (e) {}
  };

  const playClickSoundPlaylist = () => {
    try {
      clickSoundPlaylist.current.currentTime = 0;
      clickSoundPlaylist.current.play();
    } catch (e) {}
  };

  // Woosh hover sound for flyout
  const handleMouseEnter = () => {
    try {
      audioHover.current.currentTime = 0;
      audioHover.current.volume = 0.2;
      audioHover.current.play();
    } catch (e) {}
  };

  const handleMouseLeave = () => {
    try {
      audioUnhover.current.currentTime = 0;
      audioUnhover.current.volume = 0.2;
      audioUnhover.current.play();
    } catch (e) {}
  };

  // keep refs in sync with state
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);
  useEffect(() => {
    isLoopRef.current = isLoop;
  }, [isLoop]);
  useEffect(() => {
    selectedPlaylistRef.current = selectedPlaylist;
  }, [selectedPlaylist]);
  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);
  useEffect(() => {
    // keep boolean ref in sync if setIsPlaying used outside helper
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Init chiptune player
  useEffect(() => {
    const initPlayer = async () => {
      try {
        player.current = new ChiptuneJsPlayer({ repeatCount: 0 });

        // attempt to pre-load worklet (non-critical)
        try {
          const ctx =
            player.current?.audioContext ||
            player.current?.ctx ||
            player.current?.context ||
            (player.current?.getAudioContext &&
              player.current.getAudioContext());
          if (
            ctx &&
            ctx.audioWorklet &&
            typeof ctx.audioWorklet.addModule === "function"
          ) {
            await ctx.audioWorklet
              .addModule("/libopenmpt.worklet.js")
              .catch(() => {});
          }
        } catch (e) {}

        if (player.current) {
          // Use onTrackEndRef so the handler always calls the latest onTrackEnd logic
          player.current.endHandler = () => {
            window.requestAnimationFrame(() => {
              if (typeof onTrackEndRef.current === "function")
                onTrackEndRef.current();
            });
          };
        }

        setIsReady(true);
      } catch (e) {
        console.error("init player failed", e);
      }
    };

    if (window.Module) {
      if (window.Module.calledRun) initPlayer();
      else {
        const old = window.Module.onRuntimeInitialized;
        window.Module.onRuntimeInitialized = () => {
          if (old) old();
          initPlayer();
        };
      }
    } else {
      initPlayer();
    }

    try {
      startupSound.current.play().catch(() => {});
    } catch (e) {}
    const timer = setTimeout(() => setShowStartup(false), 3800);

    return () => {
      try {
        if (player.current && typeof player.current.stop === "function")
          player.current.stop();
      } catch (e) {}
      clearTimeout(timer);
      if (progressIntervalRef.current)
        clearInterval(progressIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // progress polling (0..1)
  const startProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (!player.current || !isPlayingRef.current) return;
      try {
        const pos =
          (typeof player.current.position === "function" &&
            player.current.position()) ||
          0;
        const dur = durationRef.current || 0;
        if (dur > 0) {
          progressRef.current = Math.min(1, pos / dur);
          window.dispatchEvent(new CustomEvent("chiptune-progress-update"));
        }
      } catch (e) {}
    }, 200);
  }, []);

  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // set current track UI immediately and keep ref in sync
  const setActiveIndexImmediate = useCallback((idx) => {
    currentTrackIndexRef.current = idx;
    setCurrentTrackIndex(idx);
  }, []);

  // Play a specific track (returns a Promise that resolves when playback started)
  const playTrack = useCallback(
    async (index) => {
      // return a promise that resolves when load callback runs
      return new Promise(async (resolve) => {
        if (!selectedPlaylistRef.current || !player.current || !isReady) {
          resolve(false);
          return;
        }

        // prevent concurrent loads by stopping previous load/play if necessary
        try {
          if (loadingRef.current) {
            // try to stop previous operations to make way for new load
            try {
              if (typeof player.current.stop === "function")
                player.current.stop();
            } catch (e) {}
            loadingRef.current = false;
            currentBufferRef.current = null;
          }
        } catch (e) {}

        const len = selectedPlaylistRef.current.tracks.length;
        if (index == null || index < 0 || index >= len) {
          resolve(false);
          return;
        }

        const track = selectedPlaylistRef.current.tracks[index];
        if (!track) {
          resolve(false);
          return;
        }

        // immediate UI update so button/track highlight is responsive
        setActiveIndexImmediate(index);
        pausedPositionRef.current = null; // clear paused pos

        await resumeAudioContextIfNeeded(player.current).catch(() => {});

        try {
          loadingRef.current = true;

          // stop currently playing buffer to avoid overlap (best-effort)
          try {
            if (typeof player.current.stop === "function")
              player.current.stop();
          } catch (e) {}

          player.current.load(track.url, (buffer) => {
            loadingRef.current = false;
            currentBufferRef.current = buffer || null;

            // attempt to play/resume using available API
            try {
              if (typeof player.current.play === "function")
                player.current.play(buffer);
              else if (typeof player.current.resume === "function")
                player.current.resume();
              else if (typeof player.current.start === "function")
                player.current.start();
            } catch (e) {
              console.warn("play() attempt failed:", e);
            }

            // **use helper to update state + ref**
            setPlayingState(true);

            // read metadata/duration if available
            try {
              const meta =
                (typeof player.current.metadata === "function" &&
                  player.current.metadata()) ||
                {};
              durationRef.current =
                meta.duration_seconds || durationRef.current || 0;
            } catch (e) {
              durationRef.current = durationRef.current || 0;
            }

            startProgressPolling();
            resolve(true);
          });
        } catch (err) {
          // if load throws, clear loading flag and try fallback fetch path
          loadingRef.current = false;
          console.warn("player.load threw; attempting fetch fallback", err);

          // fallback fetch then load (best-effort)
          try {
            loadingRef.current = true;
            const resp = await fetch(track.url);
            const ab = await resp.arrayBuffer();
            player.current.load(ab, (buffer) => {
              loadingRef.current = false;
              currentBufferRef.current = buffer || null;
              try {
                if (typeof player.current.play === "function")
                  player.current.play(buffer);
                else if (typeof player.current.resume === "function")
                  player.current.resume();
              } catch (e) {}
              // **use helper**
              setPlayingState(true);
              try {
                const meta =
                  (typeof player.current.metadata === "function" &&
                    player.current.metadata()) ||
                  {};
                durationRef.current =
                  meta.duration_seconds || durationRef.current || 0;
              } catch (e) {}
              startProgressPolling();
              resolve(true);
            });
          } catch (e) {
            loadingRef.current = false;
            console.error("fallback load failed", e);
            resolve(false);
          }
        }
      });
    },
    [isReady, startProgressPolling, setActiveIndexImmediate, setPlayingState]
  );

  // Play / Pause toggle with robust fallback
  const handlePlayPause = useCallback(async () => {
    playClickSoundControls();
    if (!player.current || !isReady) return;

    await resumeAudioContextIfNeeded(player.current).catch(() => {});

    const p = player.current;

    // If currently playing -> pause (do NOT change track)
    if (isPlayingRef.current) {
      try {
        if (typeof p.togglePause === "function") {
          p.togglePause();
        } else if (typeof p.pause === "function") {
          p.pause();
        } else {
          // fallback: remember position and stop
          try {
            const pos = typeof p.position === "function" ? p.position() : null;
            if (pos != null) pausedPositionRef.current = pos;
          } catch (e) {}
          try {
            if (typeof p.stop === "function") p.stop();
          } catch (e) {}
        }
      } catch (e) {
        /* ignore pause errors */
      }

      setPlayingState(false);
      stopProgressPolling();
      return;
    }

    // If not playing -> resume if possible (do NOT start a different track)
    try {
      // prefer simple togglePause/resume if available
      if (typeof p.togglePause === "function") {
        p.togglePause();
        setPlayingState(true);
        startProgressPolling();
        return;
      }
      if (typeof p.resume === "function") {
        p.resume();
        setPlayingState(true);
        startProgressPolling();
        return;
      }
    } catch (e) {
      // ignore and try other resume options
    }

    // If a buffer is already loaded, resume/play that buffer (do NOT load another track)
    if (currentBufferRef.current) {
      try {
        if (typeof p.play === "function") p.play(currentBufferRef.current);
        else if (typeof p.start === "function") p.start();
        // restore paused position if we saved one
        if (pausedPositionRef.current != null) {
          setTimeout(() => {
            try {
              if (typeof p.setPosition === "function")
                p.setPosition(pausedPositionRef.current);
              else if (typeof p.seek === "function")
                p.seek(pausedPositionRef.current);
            } catch (e) {}
            pausedPositionRef.current = null;
          }, 40);
        }
        setPlayingState(true);
        startProgressPolling();
        return;
      } catch (e) {
        console.warn(
          "resume-from-buffer failed, will try loading currentIndex",
          e
        );
      }
    }

    // If a load is in progress, do nothing (prevent double-loading/random switching)
    if (loadingRef.current) {
      // optionally we could set a flag to auto-resume when load finishes, but safer to do nothing
      return;
    }

    // Nothing loaded -> start currentIndex (or random if null). This is the *only* place we call playTrack from pause/resume.
    if (selectedPlaylistRef.current) {
      const idx =
        currentTrackIndexRef.current != null
          ? currentTrackIndexRef.current
          : Math.floor(
              Math.random() * selectedPlaylistRef.current.tracks.length
            );
      setActiveIndexImmediate(idx);
      await playTrack(idx);
    }
  }, [
    isReady,
    playTrack,
    startProgressPolling,
    stopProgressPolling,
    setActiveIndexImmediate,
    setPlayingState,
  ]);

  // Next (async; uses currentTrackIndexRef to be consistent)
  const handleNext = useCallback(
    async (ev) => {
      playClickSoundControls();
      if (!selectedPlaylistRef.current || !player.current) return;
      const len = selectedPlaylistRef.current.tracks.length;
      if (len === 0) return;

      const cur = currentTrackIndexRef.current;
      let nextIndex;
      if (isShuffleRef.current) {
        if (len === 1) nextIndex = 0;
        else {
          let tries = 0;
          do {
            nextIndex = Math.floor(Math.random() * len);
            tries++;
          } while (nextIndex === cur && tries < 8);
        }
      } else {
        nextIndex = cur == null ? 0 : (cur + 1) % len;
      }

      // immediate UI change
      setActiveIndexImmediate(nextIndex);

      // if reached end and loop disabled and not shuffle => stop
      if (!isLoopRef.current && !isShuffleRef.current && cur === len - 1) {
        try {
          if (typeof player.current.stop === "function") player.current.stop();
        } catch (e) {}
        setPlayingState(false);
        stopProgressPolling();
        return;
      }

      // Ensure any current play is stopped before loading new track (best-effort)
      try {
        if (loadingRef.current && typeof player.current.stop === "function") {
          player.current.stop();
          loadingRef.current = false;
        }
      } catch (e) {}

      // Await the play operation so audio follows UI
      await playTrack(nextIndex);
    },
    [playTrack, setActiveIndexImmediate, stopProgressPolling, setPlayingState]
  );

  // Prev (async; uses currentTrackIndexRef)
  const handlePrev = useCallback(
    async (ev) => {
      playClickSoundControls();
      if (!selectedPlaylistRef.current || !player.current) return;
      const len = selectedPlaylistRef.current.tracks.length;
      if (len === 0) return;

      const cur = currentTrackIndexRef.current;
      let prevIndex;
      if (isShuffleRef.current) prevIndex = Math.floor(Math.random() * len);
      else prevIndex = cur == null ? 0 : (cur - 1 + len) % len;

      setActiveIndexImmediate(prevIndex);

      if (!isLoopRef.current && !isShuffleRef.current && cur === 0) {
        try {
          if (typeof player.current.stop === "function") player.current.stop();
        } catch (e) {}
        setPlayingState(false);
        stopProgressPolling();
        return;
      }

      try {
        if (loadingRef.current && typeof player.current.stop === "function") {
          player.current.stop();
          loadingRef.current = false;
        }
      } catch (e) {}

      await playTrack(prevIndex);
    },
    [playTrack, setActiveIndexImmediate, stopProgressPolling, setPlayingState]
  );

  // keep ref for endHandler compatibility if other code references handleNextRef
  handleNextRef.current = handleNext;

  const handleShuffle = useCallback(() => {
    playClickSoundControls();
    setIsShuffle((s) => !s);
  }, []);
  const handleLoop = useCallback(() => {
    playClickSoundControls();
    setIsLoop((l) => !l);
  }, []);

  // onTrackEnd chooses next track using same rules and continues playback
  const onTrackEnd = useCallback(() => {
    const cur = currentTrackIndexRef.current;
    const pl = selectedPlaylistRef.current;
    if (!pl || !player.current) return;
    const len = pl.tracks.length;
    if (len === 0) return;

    // If shuffle: pick a random (avoid same track when possible)
    if (isShuffleRef.current) {
      let nextIndex = 0;
      if (len === 1) nextIndex = 0;
      else {
        let tries = 0;
        do {
          nextIndex = Math.floor(Math.random() * len);
          tries++;
        } while (nextIndex === cur && tries < 8);
      }
      setActiveIndexImmediate(nextIndex);
      // fire-and-forget (playTrack returns a promise). No need to await here.
      playTrack(nextIndex);
      return;
    }

    // Not shuffle => move to next sequential track
    if (cur == null) {
      setActiveIndexImmediate(0);
      playTrack(0);
      return;
    }

    if (cur < len - 1) {
      const nextIndex = cur + 1;
      setActiveIndexImmediate(nextIndex);
      playTrack(nextIndex);
      return;
    }

    // cur is last track
    if (isLoopRef.current) {
      // wrap around
      setActiveIndexImmediate(0);
      playTrack(0);
      return;
    }

    // reached end, no loop and not shuffle -> stop playback
    try {
      if (typeof player.current.stop === "function") player.current.stop();
    } catch (e) {}
    setPlayingState(false);
    stopProgressPolling();
  }, [
    playTrack,
    setActiveIndexImmediate,
    stopProgressPolling,
    setPlayingState,
  ]);

  // keep onTrackEndRef updated with latest implementation
  useEffect(() => {
    onTrackEndRef.current = onTrackEnd;
  }, [onTrackEnd]);

  // When playlist selected, autoplay random track and continue
  useEffect(() => {
    if (selectedPlaylist && isReady) {
      const idx = Math.floor(Math.random() * selectedPlaylist.tracks.length);
      setActiveIndexImmediate(idx);
      playTrack(idx);
    }
  }, [selectedPlaylist, isReady, playTrack, setActiveIndexImmediate]);

  // UI re-render for progress updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => (t + 1) % 1000000);
    window.addEventListener("chiptune-progress-update", handler);
    return () =>
      window.removeEventListener("chiptune-progress-update", handler);
  }, []);

  // Seek (0..1) — update UI immediately and call available API methods
  const handleSeek = (ratio) => {
    // immediate UI
    progressRef.current = ratio;
    window.dispatchEvent(new CustomEvent("chiptune-progress-update"));

    if (!player.current || durationRef.current === 0) return;
    const seconds = ratio * durationRef.current;
    try {
      if (typeof player.current.setPosition === "function")
        player.current.setPosition(seconds);
      else if (typeof player.current.seek === "function")
        player.current.seek(seconds);
      else if (typeof player.current.set_position === "function")
        player.current.set_position(seconds);
      // update pausedPosition as well so if paused and user seeks, resume will use new pos
      pausedPositionRef.current = seconds;
    } catch (e) {
      console.warn("seek failed", e);
    }
  };

  // volume handling
  useEffect(() => {
    if (player.current && isReady) {
      try {
        if (typeof player.current.setVol === "function")
          player.current.setVol(volume);
        else if (typeof player.current.setVolume === "function")
          player.current.setVolume(volume);
      } catch (e) {}
    }
  }, [volume, isReady]);

  const uiProgress = progressRef.current || 0;

  if (showStartup) {
    return (
      <div className="startup startup crt-scanlines crt-flicker crt-colorsep">
        <img src="/Pix/startup.png" alt="Startup" className="startup-image" />
      </div>
    );
  }

  return (
    <div className="app flex crt-scanlines crt-flicker crt-colorsep">
      <div className="sticky-controls crt-scanlines crt-flicker crt-colorsep">
        <div className="controls-row">
          <div className="player-logo">
            <img src="./tracker.png" alt="Logo" width="30" height="30" />
            <h1>
              <a
                className="logo-text"
                href="/"
                title="Home! Party like it is 1994!"
              >
                TrackOrDie'94
              </a>
            </h1>
          </div>

          <div className="eq-wrapper">
            <Equalizer playerRef={player} />
          </div>

          {!selectedPlaylist && (
            <div className="title-container">
              <p className="logo-title">
                <span className="title-span">░▒▓</span> TRACKERNINJA COLLECTION{" "}
                <span className="title-span"> ▓▒░</span>
              </p>
            </div>
          )}

          <div
            className={`seekbar-wrapper ${
              selectedPlaylist ? "visible" : "hidden"
            }`}
          >
            <div className="volume-bar">
              <div className="seek-bar-wrap">
                <div className="volume-wrapper">
                  <p className="text-4-slider">Vol</p>
                  <input
                    className="audio-bar"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(volume * 100)}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  />
                </div>
              </div>
            </div>

            <div className="progress-and-eq">
              <div className="seek-bar-wrap">
                <div className="position-wrapper">
                  <p className="text-4-slider">Pos</p>
                  {/* SEEK BAR - user requested this control */}
                  <input
                    className="seek-bar"
                    type="range"
                    min="0"
                    max="1000"
                    value={Math.round(uiProgress * 1000)}
                    onChange={(e) => handleSeek(Number(e.target.value) / 1000)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`controls-left ${
              selectedPlaylist ? "visible" : "hidden"
            }`}
          >
            <button onClick={handlePrev} title="Previous track">
              ◄◄
            </button>
            <button
              onClick={handlePlayPause}
              title="Play/Pause"
              className={isPlayingRef.current ? "playing" : "paused"}
            >
              {isPlayingRef.current ? "II" : "►"}
            </button>
            <button onClick={handleNext} title="Next track">
              ►►
            </button>
            <button
              onClick={handleShuffle}
              title="Shuffle toggle"
              className={isShuffle ? "on" : "off"}
            >
              {isShuffle ? "≈ On" : "≈ Off"}
            </button>
            <button
              onClick={handleLoop}
              title="Loop toggle"
              className={isLoop ? "on" : "off"}
            >
              {isLoop ? "∞ On" : "∞ Off"}
            </button>
          </div>
        </div>
      </div>
      <div className="left-right-wrapper">
        <div className="left">
          <div className="power-led">
            POWER LED
            <div className="led" />
          </div>
          <h2>Playlists</h2>

          <ul>
            {playlists.map((pl, idx) => (
              <li
                key={idx}
                onClick={() => {
                  playClickSoundPlaylist();
                  setSelectedPlaylist(pl);
                }}
                className={selectedPlaylist?.name === pl.name ? "active" : ""}
              >
                {pl.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="right">
          {selectedPlaylist ? (
            <>
              <div className="playlist-title-puter">
                <h2>{selectedPlaylist.name}</h2>
                <img className="puter" src="/pix/puter.svg" width="80" />
              </div>
              <ul className="tracks">
                {selectedPlaylist.tracks.map((track, idx) => (
                  <li
                    key={idx}
                    onClick={() => {
                      playClickSoundControls();
                      setActiveIndexImmediate(idx);
                      playTrack(idx);
                    }}
                    className={currentTrackIndex === idx ? "active" : ""}
                  >
                    <span className="track-icon">
                      {currentTrackIndex === idx ? "►" : ""}
                    </span>
                    {track.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="introDescription1">
                Here you will find all tracker music that were posted on
                Trackerninja's Tik-Tok channel from 2021 to 2027 wrapped in a
                nice web GUI app. So, pick your style on the left playlist menu
                and you are good to go. Currently application is in Alpha test
                so not so much is available, but things are about to change!
              </p>
              <p className="introDescription2">
                Unblock audio restrictions for this website to fully enjoy it!
                <br />
                Compatible with 1280x1024 4:3 aspect ratio monitors.
                <br />
                No cell phones are welcomed here.
              </p>
              <p className="introDescription3">
                This lil' project is brought to you by
              </p>
              <p className="introDescription4">
                <a
                  href="https://trackerninja.codeberg.page"
                  target="_blank"
                  rel="noreferrer"
                >
                  trackerninja.codeberg.page
                </a>
              </p>
              <p className="introDescription5">
                Startup sound: Neo Geo CD startup jingle
              </p>
              <p className="introDescription6">
                Startup illustration and audio design:
              </p>
              <p className="introDescription7">
                <a
                  href="https://stock.adobe.com/contributor/204789995/spacedrone808"
                  target="_blank"
                  rel="noreferrer"
                >
                  Spacedrone808 aka TrackerNinja
                </a>
              </p>
            </>
          )}
        </div>

        <Hotkeys
          onPlayPause={handlePlayPause}
          onPrev={handlePrev}
          onNext={handleNext}
          onShuffle={handleShuffle}
          onLoop={handleLoop}
          onVolumeUp={() =>
            setVolume((v) => Math.min(1, Math.round((v + 0.05) * 100) / 100))
          }
          onVolumeDown={() =>
            setVolume((v) => Math.max(0, Math.round((v - 0.05) * 100) / 100))
          }
        />
        <BackdropPicker />
        <PowerSwitch />
      </div>
      <div
        className="flyout-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {/* <p className="flyout-arrow"> ◄</p> */}
      <div className="flyout crt-scanlines crt-flicker crt-colorsep">
        <span className="about">ABOUT APP </span>
        <p>
          React-based web application is intended to play tracker music by means
          of
          <a
            className="fly-chip"
            href="https://www.npmjs.com/package/chiptune3"
          >
            Chiptune3.js
          </a>{" "}
          and{" "}
          <a
            className="fly-mpt"
            href="https://lib.openmpt.org/libopenmpt/download"
          >
            OpenMPT
          </a>{" "}
          libraries. Made by{" "}
          <a className="fly-trk" href="https://trackerninja.codeberg.page">
            {" "}
            TrackerNinja
          </a>{" "}
          in 2025 ©
        </p>
        <br />
        <p className="flyout-help">
          <span className="mini">MINI HELP </span>
          <br />
          [SPACE] ▀ Play/Pause <br />
          [LEFT] ▀ Previous track <br />
          [RIGHT] ▀ Next track <br />
          [UP] ▀ Volume up <br />
          [DOWN] ▀ Volume down <br />
          [F10] ▀ Shuffle toggle <br />
          [F11] ▀ Loop toggle <br />
        </p>
      </div>
    </div>
  );
}
