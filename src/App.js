// App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChiptuneJsPlayer } from "chiptune3";
import Hotkeys from "./components/Hotkeys";
import PowerSwitch from "./components/PowerSwitch";
import BackdropPicker from "./components/BackdropPicker";
import Equalizer from "./components/Equalizer";
import ScrollTop from "./components/ScrollTop";
import "./App.css";

// Constants / module-scope guards
const ASSETS_CACHE_NAME = "trackerninja-assets-v1";
if (
  typeof window !== "undefined" &&
  window.__TRACKER_ASSETS_PRELOADED == null
) {
  window.__TRACKER_ASSETS_PRELOADED = false;
}

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
  // Deploy path helper on resources like Github
  const PUBLIC_URL = process.env.PUBLIC_URL || "";

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
  const loadingRef = useRef(false);
  const handleNextRef = useRef(null);
  const powerSwitchRef = useRef(null);

  // UI audio refs (do NOT construct with `new Audio(...)` at render time)
  const clickSoundControls = useRef(null);
  const clickSoundPlaylist = useRef(null);
  const startupSound = useRef(
    new Audio(PUBLIC_URL + "/Audio/on-off/startup.mp3")
  );
  const audioHover = useRef(null);
  const audioUnhover = useRef(null);

  // Refs to support sync behaviour
  const isPlayingRef = useRef(false);
  const setPlayingState = useCallback((v) => {
    isPlayingRef.current = v;
    setIsPlaying(v);
  }, []);

  const currentTrackIndexRef = useRef(null);
  const isShuffleRef = useRef(isShuffle);
  const isLoopRef = useRef(isLoop);
  const selectedPlaylistRef = useRef(selectedPlaylist);
  const onTrackEndRef = useRef(null);
  const pausedPositionRef = useRef(null);

  // playlists data (kept inside component so PUBLIC_URL is available)
  const playlists = [
    {
      name: "DEMOSCENE",
      tracks: [
        {
          name: "Moby - Fury Forest",
          url: `${PUBLIC_URL}/Music/demoscene/furyforest.mod`,
        },
        {
          name: "Firage - Galaxy Hero",
          url: PUBLIC_URL + "/Music/demoscene/galaxyhero.mod",
        },
        {
          name: "Michael - Open Your Heart",
          url: PUBLIC_URL + "/Music/demoscene/heart.mod",
        },
        {
          name: "Alien - Robocop III",
          url: PUBLIC_URL + "/Music/demoscene/robocop3.xm",
        },
        {
          name: "Moby - Fury Forest",
          url: `${PUBLIC_URL}/Music/demoscene/furyforest.mod`,
        },
        {
          name: "Firage - Galaxy Hero",
          url: PUBLIC_URL + "/Music/demoscene/galaxyhero.mod",
        },
        {
          name: "Michael - Open Your Heart",
          url: PUBLIC_URL + "/Music/demoscene/heart.mod",
        },
        {
          name: "Alien - Robocop III",
          url: PUBLIC_URL + "/Music/demoscene/robocop3.xm",
        },
        {
          name: "Moby - Fury Forest",
          url: `${PUBLIC_URL}/Music/demoscene/furyforest.mod`,
        },
        {
          name: "Firage - Galaxy Hero",
          url: PUBLIC_URL + "/Music/demoscene/galaxyhero.mod",
        },
        {
          name: "Michael - Open Your Heart",
          url: PUBLIC_URL + "/Music/demoscene/heart.mod",
        },
        {
          name: "Alien - Robocop III",
          url: PUBLIC_URL + "/Music/demoscene/robocop3.xm",
        },
      ],
    },
    {
      name: "GAMES",
      tracks: [
        {
          name: "BaseHead - Crusader",
          url: PUBLIC_URL + "/Music/games/basehead.s3m",
        },
        {
          name: "Silent Mode - Eternity",
          url: PUBLIC_URL + "/Music/games/eternity.mod",
        },
        {
          name: "Alexander Brandon - Jazz The Jack Rabbit",
          url: PUBLIC_URL + "/Music/games/jazz.s3m",
        },
        {
          name: "C.C.Catch - One Must Fall",
          url: PUBLIC_URL + "/Music/games/omf2097.s3m",
        },
      ],
    },
    {
      name: "KEYGEN",
      tracks: [
        {
          name: "Unknown - ST-Style",
          url: PUBLIC_URL + "/Music/keygen/flcstst.xm",
        },
        { name: "Dubmood - Lucid", url: PUBLIC_URL + "/Music/keygen/lucid.xm" },
        {
          name: "FLC - Stargliders",
          url: PUBLIC_URL + "/Music/keygen/stargliders.xm",
        },
        {
          name: "Unknown - Your Dreams",
          url: PUBLIC_URL + "/Music/keygen/yr-dreamz.xm",
        },
      ],
    },
    {
      name: "TRANCE",
      tracks: [
        {
          name: "Adnan - Drilling",
          url: PUBLIC_URL + "/Music/trance/driling.it",
        },
        {
          name: "Revisq - Fish, fish ... ",
          url: PUBLIC_URL + "/Music/trance/fish.mod",
        },
        {
          name: "Unknown - I'am My Slave",
          url: PUBLIC_URL + "/Music/trance/slave.xm",
        },
        {
          name: "Mobby - A Trip To Trance",
          url: PUBLIC_URL + "/Music/trance/trip.mod",
        },
      ],
    },
  ];

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
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // UI asset lists for preloading
  const uiAudioFiles = [
    "/Audio/clicks/click-1.mp3",
    "/Audio/clicks/click-2.mp3",
    "/Audio/on-off/startup.mp3",
    "/Audio/hover/hover.mp3",
    "/Audio/hover/unhover.mp3",
  ].map((p) => PUBLIC_URL + p);

  const pixFiles = ["/Pix/backdrops/backdrop-1.png"].map((p) => PUBLIC_URL + p);

  // Preload assets function (StrictMode-safe)
  const preloadAssets = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (window.__TRACKER_ASSETS_PRELOADED) return;
    window.__TRACKER_ASSETS_PRELOADED = true;

    try {
      // 1) Cache UI audio, pix, and
      if ("caches" in window) {
        const cache = await caches.open(ASSETS_CACHE_NAME);
        const all = [...uiAudioFiles, ...pixFiles];
        try {
          await cache.addAll(all);
        } catch (e) {
          // add individually so one bad URL doesn't block everything
          await Promise.all(
            all.map(async (u) => {
              try {
                await cache.add(u);
              } catch (err) {
                // silent warn
                console.warn("cache.add failed for", u, err);
              }
            })
          );
        }
      }

      // 2) Create singleton Audio objects using cached blob if possible
      async function makeAudio(url) {
        if ("caches" in window) {
          try {
            const cache = await caches.open(ASSETS_CACHE_NAME);
            const resp = await cache.match(url);
            if (resp && resp.ok) {
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = new Audio(blobUrl);
              a.preload = "auto";
              try {
                a.load();
              } catch (e) {}
              return { audio: a, blobUrl };
            }
          } catch (e) {
            // fallthrough to direct Audio
          }
        }
        // fallback
        const a = new Audio(url);
        a.preload = "auto";
        try {
          a.load();
        } catch (e) {}
        return { audio: a, blobUrl: null };
      }

      const [ctrl, pl, st, hover, unhover] = await Promise.all(
        uiAudioFiles.map((u) =>
          makeAudio(u).catch((e) => {
            console.warn("makeAudio failed for", u, e);
            return { audio: null, blobUrl: null };
          })
        )
      );

      if (ctrl && ctrl.audio) clickSoundControls.current = ctrl.audio;
      if (pl && pl.audio) clickSoundPlaylist.current = pl.audio;
      if (st && st.audio) startupSound.current = st.audio;
      if (hover && hover.audio) audioHover.current = hover.audio;
      if (unhover && unhover.audio) audioUnhover.current = unhover.audio;

      // Preload images to warm decoder/cache (won't double fetch if cached)
      pixFiles.forEach((imgUrl) => {
        const img = new Image();
        img.src = imgUrl;
      });

      // Set backdrop CSS var (browser will resolve using cached resource)
      const backdropUrl = PUBLIC_URL + "/Pix/backdrops/backdrop-1.png";
      document.documentElement.style.setProperty(
        "--backdrop-url",
        `url("${backdropUrl}")`
      );
    } catch (e) {
      console.warn("preloadAssets failed", e);
    }
  }, [PUBLIC_URL, uiAudioFiles, pixFiles]);

  // call preload once on mount
  useEffect(() => {
    // start preloading (do not await in case it takes time)
    preloadAssets().catch(() => {});
  }, [preloadAssets]);

  // helper to play UI sounds safely
  const playClickSoundControls = () => {
    try {
      if (clickSoundControls.current) {
        clickSoundControls.current.currentTime = 0;
        clickSoundControls.current.play();
      }
    } catch (e) {}
  };

  const playClickSoundPlaylist = () => {
    try {
      if (clickSoundPlaylist.current) {
        clickSoundPlaylist.current.currentTime = 0;
        clickSoundPlaylist.current.play();
      }
    } catch (e) {}
  };

  const handleMouseEnter = () => {
    try {
      if (audioHover.current) {
        audioHover.current.currentTime = 0;
        audioHover.current.volume = 0.2;
        audioHover.current.play();
      }
    } catch (e) {}
  };

  const handleMouseLeave = () => {
    try {
      if (audioUnhover.current) {
        audioUnhover.current.currentTime = 0;
        audioUnhover.current.volume = 0.2;
        audioUnhover.current.play();
      }
    } catch (e) {}
  };

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
              .addModule(`${PUBLIC_URL}/libopenmpt.worklet.js`)
              .catch(() => {});
          }
        } catch (e) {}

        if (player.current) {
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

    // play startup sound if available (preload ensures it's probably ready)
    try {
      if (startupSound.current) startupSound.current.play().catch(() => {});
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
      // NOTE: if you created blob URLs and want to revoke them on unload, do it here.
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

  const setActiveIndexImmediate = useCallback((idx) => {
    currentTrackIndexRef.current = idx;
    setCurrentTrackIndex(idx);
  }, []);

  const playTrack = useCallback(
    async (index) => {
      return new Promise(async (resolve) => {
        if (!selectedPlaylistRef.current || !player.current || !isReady) {
          resolve(false);
          return;
        }

        try {
          if (loadingRef.current) {
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

        setActiveIndexImmediate(index);
        pausedPositionRef.current = null;

        await resumeAudioContextIfNeeded(player.current).catch(() => {});

        try {
          loadingRef.current = true;

          try {
            if (typeof player.current.stop === "function")
              player.current.stop();
          } catch (e) {}

          // First try native load(url)
          player.current.load(track.url, (buffer) => {
            loadingRef.current = false;
            currentBufferRef.current = buffer || null;

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

            setPlayingState(true);

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
          loadingRef.current = false;
          console.warn("player.load threw; attempting fetch fallback", err);

          try {
            loadingRef.current = true;
            // fetch should hit the Cache if cached earlier
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

  const handlePlayPause = useCallback(async () => {
    playClickSoundControls();
    if (!player.current || !isReady) return;

    await resumeAudioContextIfNeeded(player.current).catch(() => {});

    const p = player.current;

    if (isPlayingRef.current) {
      try {
        if (typeof p.togglePause === "function") {
          p.togglePause();
        } else if (typeof p.pause === "function") {
          p.pause();
        } else {
          try {
            const pos = typeof p.position === "function" ? p.position() : null;
            if (pos != null) pausedPositionRef.current = pos;
          } catch (e) {}
          try {
            if (typeof p.stop === "function") p.stop();
          } catch (e) {}
        }
      } catch (e) {}
      setPlayingState(false);
      stopProgressPolling();
      return;
    }

    try {
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
    } catch (e) {}

    if (currentBufferRef.current) {
      try {
        if (typeof p.play === "function") p.play(currentBufferRef.current);
        else if (typeof p.start === "function") p.start();
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

    if (loadingRef.current) {
      return;
    }

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

      setActiveIndexImmediate(nextIndex);

      if (!isLoopRef.current && !isShuffleRef.current && cur === len - 1) {
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

      await playTrack(nextIndex);
    },
    [playTrack, setActiveIndexImmediate, stopProgressPolling, setPlayingState]
  );

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

  handleNextRef.current = handleNext;

  const handleShuffle = useCallback(() => {
    playClickSoundControls();
    setIsShuffle((s) => !s);
  }, []);
  const handleLoop = useCallback(() => {
    playClickSoundControls();
    setIsLoop((l) => !l);
  }, []);

  const onTrackEnd = useCallback(() => {
    const cur = currentTrackIndexRef.current;
    const pl = selectedPlaylistRef.current;
    if (!pl || !player.current) return;
    const len = pl.tracks.length;
    if (len === 0) return;

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
      playTrack(nextIndex);
      return;
    }

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

    if (isLoopRef.current) {
      setActiveIndexImmediate(0);
      playTrack(0);
      return;
    }

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

  useEffect(() => {
    onTrackEndRef.current = onTrackEnd;
  }, [onTrackEnd]);

  useEffect(() => {
    if (selectedPlaylist && isReady) {
      const idx = Math.floor(Math.random() * selectedPlaylist.tracks.length);
      setActiveIndexImmediate(idx);
      playTrack(idx);
    }
  }, [selectedPlaylist, isReady, playTrack, setActiveIndexImmediate]);

  // UI progress re-render
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => (t + 1) % 1000000);
    window.addEventListener("chiptune-progress-update", handler);
    return () =>
      window.removeEventListener("chiptune-progress-update", handler);
  }, []);

  const handleSeek = (ratio) => {
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
      pausedPositionRef.current = seconds;
    } catch (e) {
      console.warn("seek failed", e);
    }
  };

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
        <img
          src={PUBLIC_URL + "/Pix/startup.png"}
          alt="Startup"
          className="startup-image"
        />
      </div>
    );
  }

  return (
    <div className="app flex crt-scanlines crt-flicker crt-colorsep">
      <div className="sticky-controls crt-scanlines crt-flicker crt-colorsep">
        <div className="controls-row">
          <div className="player-logo">
            <img
              src={PUBLIC_URL + "/tracker.png"}
              alt="Logo"
              className="logo-pix"
              width="50"
              height="50"
            />
            <h1>
              <a
                className="logo-text"
                href={PUBLIC_URL}
                title="Home! ♫ Party like it is 1994!"
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
              <p className="logo-title crt-flicker crt-sep">
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
                    title="Blow your speakers away! [▲] / [▼]"
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
                  <input
                    className="seek-bar"
                    type="range"
                    title="Find timing of that groovy piece! [TBD]"
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
            <button onClick={handlePrev} title="Previous track [◄]">
              ◄◄
            </button>
            <button
              onClick={handlePlayPause}
              title="Play/Pause [SPACE]"
              className={isPlayingRef.current ? "playing" : "paused"}
            >
              {isPlayingRef.current ? "II" : "►"}
            </button>
            <button onClick={handleNext} title="Next track [►]">
              ►►
            </button>
            <button
              onClick={handleShuffle}
              title="Shuffle toggle [F10]"
              className={isShuffle ? "on" : "off"}
            >
              {isShuffle ? "≈ On" : "≈ Off"}
            </button>
            <button
              onClick={handleLoop}
              title="Loop toggle [F11]"
              className={isLoop ? "on" : "off"}
            >
              {isLoop ? "∞ On" : "∞ Off"}
            </button>
          </div>
        </div>
      </div>
      <div className="left-right-wrapper">
        <div className="left crt-scanlines crt-flicker crt-colorsep">
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
                <img
                  className="puter"
                  src={PUBLIC_URL + "Pix/puter.svg"}
                  alt="Vintage puter"
                  width="80"
                />
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
              <a
                className="introDescription1-link"
                href="https://mega.nz/file/ml4WlBjT#tPOOhOfVFg9BWwLWGCsHs2CCQ3iTnVysqeWMczJacbM"
              >
                Download whole music library
              </a>
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
          onPower={() => {
            try {
              powerSwitchRef.current?.trigger?.();
            } catch (e) {}
          }}
        />
        <BackdropPicker />
        <ScrollTop />
        <PowerSwitch ref={powerSwitchRef} />
      </div>
      <div
        className="flyout-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <div className="flyout crt-scanlines crt-flicker crt-colorsep">
        <span className="about">
          ░▒▓ <span className="about-text">ABOUT APP </span> ▓▒░
        </span>
        <p className="flyout-links">
          React-based web application is intended to play tracker music by means
          of
          <a
            className="fly-chip"
            href="https://www.npmjs.com/package/chiptune3"
          >
            Chiptune3.js
          </a>
          and
          <br />
          <a
            className="fly-mpt"
            href="https://lib.openmpt.org/libopenmpt/download"
          >
            OpenMPT
          </a>
          libraries. Made by
          <a className="fly-trk" href="https://trackerninja.codeberg.page">
            TrackerNinja
          </a>
          in 2025 ©
        </p>
        <br />
        <p className="flyout-help">
          <span className="mini">
            ░▒▓ <span className="about-text"> MINI HELP </span> ▓▒░
          </span>
          <br />
          [SPACE] ▀ Play/Pause <br />
          [LEFT] ▀ Previous track <br />
          [RIGHT] ▀ Next track <br />
          [UP] ▀ Volume up <br />
          [DOWN] ▀ Volume down <br />
          [F10] ▀ Shuffle toggle <br />
          [F11] ▀ Loop toggle <br />
          [ALT+Q] ▀ Power off machine <br />
        </p>
      </div>
    </div>
  );
}
