// App.jsx
//
// Playback is driven purely by chiptune3's documented API:
//
//   load(url)            loads AND plays  <- never call play() yourself
//   play(arrayBuffer)    needs a buffer; calling it bare feeds undefined to
//                        openmpt_module_create_from_memory2 -> "error loading file"
//   stop() pause() unpause() togglePause()
//   setRepeatCount(v)    -1 endless, 0 play once  (there is no repeat())
//   seek(f) / setPos(f)  seconds
//   setVol(f)
//
//   onInitialized() onEnded() onError(err) onMetadata(meta) onProgress(pos)
//
// There is no position(), duration() or metadata() method — position arrives
// through onProgress and length through onMetadata. Advancing is driven by
// onEnded, which only fires when the module is set to play once.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChiptuneJsPlayer } from "chiptune3";
import Hotkeys from "./components/Hotkeys";
import PowerSwitch from "./components/PowerSwitch";
import BackdropPicker from "./components/BackdropPicker";
import Equalizer from "./components/Equalizer";
import ScrollTop from "./components/ScrollTop";
import StarAnimation from "./components/StarAnimation";
import TitleUpdater from "./components/TitleUpdater";
import DimensionsDetector from "./components/DimensionsDetector";
import {
  PlayIcon,
  PauseIcon,
  RewindIcon,
  FastForwardIcon,
  ShuffleOffIcon,
  ShuffleOnIcon,
  LoopOffIcon,
  LoopOnIcon,
} from "./components/Buttons";

import "./App.css";

const PUBLIC_URL = process.env.PUBLIC_URL || "";
const ASSETS_CACHE_NAME = "trackerninja-assets-v1";
const BACKDROP_URL = PUBLIC_URL + "/Pix/backdrops/backdrop-1.png";

const READY_FALLBACK_MS = 3000; // in case onInitialized never fires
const COIN_LIFETIME_MS = 800;
const COIN_HISTORY = 24;
const SMALL_SCREEN_PX = 480;
const STARTUP_MS = 3800;

const EMPTY = []; // stable identity, so effects keyed on it don't re-run

/* ------------------------------------------------------------------ helpers */

// chiptune3 owns its AudioContext; reach it through the gain node it exposes.
async function unlockAudio(p) {
  const ctx = [p?.context, p?.audioContext, p?.gain?.context].find(
    (c) => c && typeof c.resume === "function" && typeof c.state === "string"
  );
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (e) {
      console.debug("[tracker] resume rejected", e);
    }
  }
}

// The docs list these as assignable properties, the usage example calls them as
// registrars. Do both so either build wires up.
function on(p, name, fn) {
  if (typeof p[name] === "function") {
    try {
      p[name](fn);
    } catch (e) {
      /* it was a stub, not a registrar */
    }
  }
  p[name] = fn;
}

const seqOrder = (len) => Array.from({ length: len }, (_, i) => i);

// Fisher-Yates bag: every track plays once before any repeats.
function shuffleOrder(len, { pinFirst = null, avoidFirst = null } = {}) {
  const a = seqOrder(len);
  for (let i = len - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (pinFirst != null) {
    // toggling shuffle mid-song must not yank the current track away
    const at = a.indexOf(pinFirst);
    if (at > 0) [a[0], a[at]] = [a[at], a[0]];
  } else if (avoidFirst != null && len > 1 && a[0] === avoidFirst) {
    // a fresh bag must not open with the track that just finished
    [a[0], a[1]] = [a[1], a[0]];
  }
  return a;
}

/* -------------------------------------------------------------- UI sounds */
// The originals were `new Audio(...)` in the component body, i.e. three fresh
// media elements on every single render. One lazy module-scope pool instead.

const SFX = {
  click: { src: "/Audio/clicks/click-1.mp3", vol: 1 },
  clickPl: { src: "/Audio/clicks/click-2.mp3", vol: 1 },
  startup: { src: "/Audio/on-off/startup.mp3", vol: 1 },
  hover: { src: "/Audio/hover/hover.mp3", vol: 0.2 },
  unhover: { src: "/Audio/hover/unhover.mp3", vol: 0.2 },
  plHover: { src: "/Audio/hover.mp3", vol: 0.2 },
  daveHover: { src: "/Audio/8bit/arcade-blip-2.mp3", vol: 0.2 },
  daveClick: { src: "/Audio/8bit/arcade-blip-1.mp3", vol: 0.2 },
};

const sfxPool = new Map();

function sfx(name) {
  const def = SFX[name];
  if (!def) return;
  let el = sfxPool.get(name);
  if (!el) {
    el = new Audio(PUBLIC_URL + def.src);
    el.preload = "auto";
    el.volume = def.vol;
    sfxPool.set(name, el);
  }
  try {
    el.currentTime = 0;
    const started = el.play();
    if (started && started.catch) started.catch(() => {});
  } catch (e) {
    /* autoplay policy */
  }
}

let assetsPreloaded = false;

async function preloadAssets() {
  if (assetsPreloaded || typeof window === "undefined") return;
  assetsPreloaded = true; // also guards React StrictMode's double mount

  const urls = Object.values(SFX).map((s) => PUBLIC_URL + s.src);
  if ("caches" in window) {
    try {
      const cache = await caches.open(ASSETS_CACHE_NAME);
      // per-URL, not addAll: addAll is atomic and one 404 discards the batch
      await Promise.all(
        [...urls, BACKDROP_URL].map((u) =>
          cache.add(u).catch((err) => console.warn("[assets] cache miss", u, err))
        )
      );
    } catch (e) {
      console.warn("[assets] cache unavailable", e);
    }
  }

  Object.entries(SFX).forEach(([name, def]) => {
    const el = new Audio(PUBLIC_URL + def.src);
    el.preload = "auto";
    el.volume = def.vol;
    try {
      el.load();
    } catch (e) {
      /* ignore */
    }
    sfxPool.set(name, el);
  });

  const img = new Image();
  img.src = BACKDROP_URL;
  document.documentElement.style.setProperty("--backdrop-url", `url("${BACKDROP_URL}")`);
}

/* ------------------------------------------------------------- playlists */
// Hoisted out of the component: this was rebuilt on every render, which gave
// every playlist a new identity and made `selectedPlaylist` a stale reference.

const t = (name, file) => ({ name, url: `${PUBLIC_URL}/Music/${file}` });

const playlists = [
  {
    id: "games",
    name: "GAMES",
    tracks: [
      t("Test - Shortest", "games/shortest.mod"),
      t("BaseHead - Crusader", "games/basehead.s3m"),
      t("Silent Mode - Eternity", "games/eternity.mod"),
      t("Alexander Brandon - Jazz The Jack Rabbit", "games/jazz.s3m"),
      t("C.C.Catch - One Must Fall", "games/omf2097.s3m"),
    ],
  },
  {
    id: "demoscene",
    name: "DEMOSCENE",
    // the last four were repeated 3x in the original; kept verbatim, but note
    // that shuffle treats each repetition as a separate entry
    tracks: [
      t("Test - Shortest", "demoscene/shortest.mod"),
      t("Moby - Fury Forest", "demoscene/furyforest.mod"),
      t("Firage - Galaxy Hero", "demoscene/galaxyhero.mod"),
      t("Michael - Open Your Heart", "demoscene/heart.mod"),
      t("Alien - Robocop III", "demoscene/robocop3.xm"),
      t("Moby - Fury Forest", "demoscene/furyforest.mod"),
      t("Firage - Galaxy Hero", "demoscene/galaxyhero.mod"),
      t("Michael - Open Your Heart", "demoscene/heart.mod"),
      t("Alien - Robocop III", "demoscene/robocop3.xm"),
      t("Moby - Fury Forest", "demoscene/furyforest.mod"),
      t("Firage - Galaxy Hero", "demoscene/galaxyhero.mod"),
      t("Michael - Open Your Heart", "demoscene/heart.mod"),
      t("Alien - Robocop III", "demoscene/robocop3.xm"),
    ],
  },
  {
    id: "keygen",
    name: "KEYGEN",
    tracks: [
      t("Test - Shortest", "keygen/shortest.mod"),
      t("Unknown - ST-Style", "keygen/flcstst.xm"),
      t("Dubmood - Lucid", "keygen/lucid.xm"),
      t("FLC - Stargliders", "keygen/stargliders.xm"),
      t("Unknown - Your Dreams", "keygen/yr-dreamz.xm"),
    ],
  },
  {
    id: "pop",
    name: "POP",
    tracks: [
      t("Test - Shortest", "pop/shortest.mod"),
      t("Unknown - Duck Dance II", "pop/duckdance.it"),
      t("DJ Mohax - Gazeta", "pop/gazeta.mod"),
      t("Siatek - I Love You", "pop/iloveyou.it"),
      t("Tenchi - POS 15", "pop/pos15.it"),
    ],
  },
  {
    id: "funk",
    name: "FUNK",
    tracks: [
      t("Test - Shortest", "funk/shortest.mod"),
      t("Radix - Milk", "funk/milk.xm"),
      t("Dune - Last Train", "funk/lasttrain.s3m"),
      t("Virgill - Save My Dick", "funk/savemydick.mod"),
      t("RevisQ - Vincent's Car", "funk/vincentcar.mod"),
    ],
  },
  {
    id: "metal",
    name: "METAL",
    tracks: [
      t("Test - Shortest", "metal/shortest.mod"),
      t("Subpacket - Command & Conqueror", "metal/cckewl.xm"),
      t("MrRoot - DieHard", "metal/diehard.mod"),
      t("Tarantula - A Journey In Time", "metal/journey.it"),
      t("Darkman007 - Metal World", "metal/metalworld.it"),
    ],
  },
  {
    id: "chillout",
    name: "CHILLOUT",
    tracks: [
      t("Test - Shortest", "chillout/shortest.mod"),
      t("Unknown - Three Legged Wookie", "chillout/3legged.it"),
      t("Radix - Check Yer Feet", "chillout/checkyer.mod"),
      t("Reed - The Laid Back Funk", "chillout/laidback.mod"),
      t("RevisQ - Trip To Remix", "chillout/triptoremix.mod"),
    ],
  },
  {
    id: "electronic",
    name: "ELECTRONIC",
    tracks: [
      t("Test - Shortest", "electronic/shortest.mod"),
      t("Adnan - Drilling", "electronic/driling.it"),
      t("Revisq - Fish, fish ... ", "electronic/fish.mod"),
      t("Unknown - I'am My Slave", "electronic/slave.xm"),
      t("Mobby - A Trip To Trance", "electronic/trip.mod"),
    ],
  },
];

/* --------------------------------------------------- small child components */
// Also hoisted: declared inside App() they were a new component type on every
// render, so React remounted the subtree and PlaylistTabs' effect re-fired.

const Coin = ({ x, y }) => (
  <div
    className="coin"
    style={{ position: "absolute", left: `${x}px`, top: `${y}px`, zIndex: 2000000 }}
  >
    $
  </div>
);

const Coins = ({ coins }) => coins.map((c) => <Coin key={c.id} x={c.x} y={c.y} />);

const Dave = ({ onSummon, style }) => (
  <img
    className="dave"
    style={style}
    src={PUBLIC_URL + "/Pix/dangerous-dave.png"}
    alt="Dangerous Dave"
    title="No Dangerous Daves were harmed during production! Click me for powerUp!"
    width="204"
    onMouseEnter={() => sfx("daveHover")}
    onClick={() => {
      sfx("daveClick");
      onSummon();
    }}
  />
);

const PlaylistTabs = ({ selectedPlaylist, onSelect, isSmallScreen }) => {
  const stripRef = useRef(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !selectedPlaylist) return;
    const tab = strip.querySelector(
      `.playlist-tab[data-id="${CSS.escape(selectedPlaylist.id)}"]`
    );
    if (!tab) return;
    const offset = tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  }, [selectedPlaylist]);

  return (
    <div className="playlist-tabs-wrap" aria-hidden={playlists.length === 0}>
      <div className="playlist-tabs" ref={stripRef} tabIndex={0} style={{ touchAction: "pan-x" }}>
        {playlists.map((pl) => (
          <button
            key={pl.id}
            data-id={pl.id}
            data-name={pl.name}
            className={`playlist-tab ${selectedPlaylist?.id === pl.id ? "active" : ""}`}
            onClick={() => {
              sfx("clickPl");
              onSelect(pl);
            }}
            onTouchStart={() => {
              if (!isSmallScreen) sfx("hover");
            }}
            aria-pressed={selectedPlaylist?.id === pl.id}
          >
            {pl.name}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- App */

export default function App() {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // sequential by default; set to true for the old random-start behaviour
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [showStartup, setShowStartup] = useState(true);
  const [coins, setCoins] = useState([]);

  const [isSmallScreen, setIsSmallScreen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < SMALL_SCREEN_PX : false
  );

  const player = useRef(null);
  const powerSwitchRef = useRef(null);

  // live mirrors, so the imperative callbacks below stay referentially stable
  const tracksRef = useRef(EMPTY);
  const shuffleRef = useRef(isShuffle);
  const loopRef = useRef(isLoop);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(false);
  const indexRef = useRef(null);
  const durationRef = useRef(0); // seconds, from onMetadata

  // queue
  const orderRef = useRef([]); // track indices, in play order
  const cursorRef = useRef(-1); // position inside orderRef

  // per-track bookkeeping
  const tokenRef = useRef(0); // bumped on every load; invalidates stale events
  const endGuardRef = useRef(-1); // one advance per token, max
  const startedRef = useRef(false); // has this track produced any progress?
  const failsRef = useRef(0);

  // late-bound handlers, so the player's event props never go stale
  const advanceRef = useRef(null);
  const endRef = useRef(null);
  const errRef = useRef(null);
  const metaRef = useRef(null);
  const progRef = useRef(null);

  const setPlaying = useCallback((v) => {
    isPlayingRef.current = v;
    setIsPlaying(v);
  }, []);

  const stopPlayback = useCallback(() => {
    try {
      player.current?.stop?.();
    } catch (e) {
      /* ignore */
    }
    setPlaying(false);
    setProgress(0);
  }, [setPlaying]);

  /* ---------------------------------------------------------------- playing */

  const playTrack = useCallback(
    async (index) => {
      const p = player.current;
      const list = tracksRef.current;
      const track = list[index];
      if (!p || !track) return false;

      // keep the queue cursor in sync whoever called us (click, next, onEnded)
      if (orderRef.current.length !== list.length) {
        orderRef.current = shuffleRef.current
          ? shuffleOrder(list.length, { pinFirst: index })
          : seqOrder(list.length);
      }
      const at = orderRef.current.indexOf(index);
      cursorRef.current = at >= 0 ? at : 0;

      const token = (tokenRef.current += 1); // events for older tokens are stale
      indexRef.current = index;
      setCurrentTrackIndex(index);
      setProgress(0);
      durationRef.current = 0;
      startedRef.current = false;

      try {
        p.stop?.();
      } catch (e) {
        /* ignore */
      }

      await unlockAudio(p);
      if (token !== tokenRef.current) return false; // superseded while unlocking

      try {
        // 0 = play the module once, so onEnded actually fires. With -1 the
        // module loops forever inside libopenmpt and nothing ever advances.
        p.setRepeatCount?.(0);
        p.setVol?.(volumeRef.current);
        p.load(track.url); // load() plays it. Do NOT call play() as well.
      } catch (e) {
        console.error("[tracker] load failed", track.url, e);
        return false;
      }

      setPlaying(true);
      return true;
    },
    [setPlaying]
  );

  /* ------------------------------------------------------------------ queue */

  // step: +1 for next, -1 for previous
  const advance = useCallback(
    async (step) => {
      const len = tracksRef.current.length;
      if (!len) return false;

      if (orderRef.current.length !== len) {
        orderRef.current = shuffleRef.current ? shuffleOrder(len) : seqOrder(len);
        cursorRef.current = -1;
      }

      const order = orderRef.current;
      const cursor = cursorRef.current;

      if (cursor < 0) return playTrack(order[step > 0 ? 0 : order.length - 1]);

      let next = cursor + step;

      if (next >= order.length) {
        if (!loopRef.current) {
          stopPlayback(); // end of playlist, loop off
          return false;
        }
        if (shuffleRef.current) {
          orderRef.current = shuffleOrder(len, { avoidFirst: order[order.length - 1] });
        }
        next = 0;
      } else if (next < 0) {
        // "previous" on the first track: wrap when looping, else restart it
        next = loopRef.current ? order.length - 1 : 0;
      }

      return playTrack(orderRef.current[next]);
    },
    [playTrack, stopPlayback]
  );

  /* --------------------------------------------------------- player events */

  const handleEnded = useCallback(() => {
    if (tokenRef.current === 0) return; // nothing has ever been loaded
    if (endGuardRef.current === tokenRef.current) return; // already advanced
    endGuardRef.current = tokenRef.current;
    advanceRef.current?.(1);
  }, []);

  const handleError = useCallback(
    (err) => {
      console.error("[tracker] chiptune error", err);
      if (tokenRef.current === 0) return;
      // If the track was already producing audio, this is not a load failure —
      // log it and let the module keep playing rather than skipping.
      if (startedRef.current) return;
      if (endGuardRef.current === tokenRef.current) return;
      endGuardRef.current = tokenRef.current;

      failsRef.current += 1;
      if (failsRef.current >= Math.max(3, tracksRef.current.length)) {
        failsRef.current = 0;
        stopPlayback();
        return;
      }
      advanceRef.current?.(1); // a dead file must not kill the queue
    },
    [stopPlayback]
  );

  const handleMetadata = useCallback((meta) => {
    const d = Number(meta?.dur ?? meta?.duration ?? meta?.duration_seconds);
    durationRef.current = Number.isFinite(d) && d > 0 ? d : 0;
    failsRef.current = 0;
  }, []);

  const handleProgress = useCallback((pos) => {
    const seconds = Number(typeof pos === "object" ? pos?.pos ?? pos?.position : pos);
    if (!Number.isFinite(seconds)) return;
    startedRef.current = true;

    const dur = durationRef.current;
    if (dur <= 0) return;

    const ratio = Math.min(1, seconds / dur);
    setProgress((prev) => (Math.abs(prev - ratio) > 0.0005 ? ratio : prev));

    // Safety net for builds where onEnded is not emitted. Strict >= so it can
    // only trigger once playback has genuinely run past the reported length.
    if (seconds >= dur && endGuardRef.current !== tokenRef.current) {
      endGuardRef.current = tokenRef.current;
      advanceRef.current?.(1);
    }
  }, []);

  // keep the late-bound refs pointing at the current closures
  useEffect(() => {
    advanceRef.current = advance;
    endRef.current = handleEnded;
    errRef.current = handleError;
    metaRef.current = handleMetadata;
    progRef.current = handleProgress;
  }, [advance, handleEnded, handleError, handleMetadata, handleProgress]);

  /* --------------------------------------------------------------- controls */

  const handlePlayPause = useCallback(async () => {
    sfx("click");
    const p = player.current;
    if (!p || !isReady) return;
    await unlockAudio(p);

    if (indexRef.current == null) {
      await advance(1); // nothing loaded yet: start the queue
      return;
    }

    if (isPlayingRef.current) {
      p.pause?.();
      setPlaying(false);
    } else {
      p.unpause?.();
      setPlaying(true);
    }
  }, [isReady, advance, setPlaying]);

  const handleNext = useCallback(() => {
    sfx("click");
    advance(1);
  }, [advance]);

  const handlePrev = useCallback(() => {
    sfx("click");
    advance(-1);
  }, [advance]);

  const handleShuffle = useCallback(() => {
    sfx("click");
    setIsShuffle((s) => !s);
  }, []);

  const handleLoop = useCallback(() => {
    sfx("click");
    setIsLoop((l) => !l);
  }, []);

  const handleSeek = useCallback((ratio) => {
    setProgress(ratio);
    const p = player.current;
    const dur = durationRef.current;
    if (!p || dur <= 0) return; // no length reported yet, nothing to seek within
    const seconds = ratio * dur;
    try {
      if (typeof p.seek === "function") p.seek(seconds);
      else p.setPos?.(seconds);
    } catch (e) {
      console.warn("[tracker] seek failed", e);
    }
  }, []);

  /* ----------------------------------------------------------------- effects */

  useEffect(() => {
    shuffleRef.current = isShuffle;
    const len = tracksRef.current.length;
    if (!len) return;
    const cur = indexRef.current;
    orderRef.current = isShuffle ? shuffleOrder(len, { pinFirst: cur }) : seqOrder(len);
    cursorRef.current = cur == null ? -1 : orderRef.current.indexOf(cur);
  }, [isShuffle]);

  useEffect(() => {
    loopRef.current = isLoop;
  }, [isLoop]);

  useEffect(() => {
    volumeRef.current = volume;
    if (isReady) {
      try {
        player.current?.setVol?.(volume);
      } catch (e) {
        /* ignore */
      }
    }
  }, [volume, isReady]);

  // selecting a playlist deals a fresh queue and starts at its head
  useEffect(() => {
    tracksRef.current = selectedPlaylist?.tracks || EMPTY;
    const len = tracksRef.current.length;
    orderRef.current = shuffleRef.current ? shuffleOrder(len) : seqOrder(len);
    cursorRef.current = -1;
    failsRef.current = 0;
    if (!selectedPlaylist || !isReady || !len) return;
    playTrack(orderRef.current[0]);
  }, [selectedPlaylist, isReady, playTrack]);

  useEffect(() => {
    const onResize = () => setIsSmallScreen(window.innerWidth < SMALL_SCREEN_PX);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    preloadAssets();
    sfx("startup");
    const timer = setTimeout(() => setShowStartup(false), STARTUP_MS);
    return () => clearTimeout(timer);
  }, []);

  // player lifecycle
  useEffect(() => {
    let cancelled = false;
    let instance;

    try {
      // No argument: chiptune3 creates its own AudioContext and routes to the
      // speakers. Passing one means you have to wire chiptune.gain yourself.
      instance = new ChiptuneJsPlayer();
    } catch (e) {
      console.error("[tracker] could not construct ChiptuneJsPlayer", e);
      return undefined;
    }

    on(instance, "onInitialized", () => {
      if (!cancelled) setIsReady(true);
    });
    on(instance, "onEnded", () => endRef.current?.());
    on(instance, "onError", (err) => errRef.current?.(err));
    on(instance, "onMetadata", (meta) => metaRef.current?.(meta));
    on(instance, "onProgress", (pos) => progRef.current?.(pos));

    try {
      instance.setRepeatCount?.(0);
      instance.setVol?.(volumeRef.current);
    } catch (e) {
      /* ignore */
    }

    player.current = instance;

    // if this build initialises before we attach the handler, don't hang forever
    const readyFallback = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, READY_FALLBACK_MS);

    return () => {
      cancelled = true;
      clearTimeout(readyFallback);
      try {
        instance.stop?.();
      } catch (e) {
        /* ignore */
      }
      player.current = null;
      setIsReady(false);
    };
  }, []);

  /* ------------------------------------------------------------------- coins */

  const coinIdRef = useRef(0);
  const coinHistoryRef = useRef([]);
  const coinTimersRef = useRef(new Set());

  const addCoin = useCallback(() => {
    // bounded retries + bounded history: the original `while (true)` could spin
    // forever once positionsHistory (which grew without limit) got dense
    const marginX = Math.min(250, Math.max(0, window.innerWidth / 2 - 40));
    const marginY = Math.min(250, Math.max(0, window.innerHeight / 2 - 40));
    const spanX = Math.max(1, window.innerWidth - 2 * marginX);
    const spanY = Math.max(1, window.innerHeight - 2 * marginY);

    let pos = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = {
        x: marginX + Math.random() * spanX,
        y: marginY + Math.random() * spanY,
      };
      pos = pos || candidate;
      const clear = coinHistoryRef.current.every(
        (q) => Math.hypot(candidate.x - q.x, candidate.y - q.y) >= 28
      );
      if (clear) {
        pos = candidate;
        break;
      }
    }

    const id = (coinIdRef.current += 1);
    coinHistoryRef.current = [...coinHistoryRef.current, pos].slice(-COIN_HISTORY);
    setCoins((prev) => [...prev, { ...pos, id }]);

    // one timer per coin, removed by id: the original removed by array index,
    // so coins disappeared in the wrong order once several were on screen
    const timer = setTimeout(() => {
      coinTimersRef.current.delete(timer);
      setCoins((prev) => prev.filter((c) => c.id !== id));
    }, COIN_LIFETIME_MS);
    coinTimersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const timers = coinTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  /* -------------------------------------------------------------------- view */

  if (showStartup) {
    return (
      <div className="startup crt-scanlines crt-colorsep">
        <img src={PUBLIC_URL + "/Pix/startup.png"} alt="Startup" className="startup-image" />
      </div>
    );
  }

  return (
    <>
      <div className="unsupported-container crt-scanlines crt-colorsep">
        {/* <DimensionsDetector /> */}
        <div className="unsupported-text">
          This web application is intended to run on desktop / laptop /
          smartphone.
          <span className="testbed">
            {" "}
            Also it is a testbed playground for restricting user in case when
            resolution is not matched require one and showcasing such messages.{" "}
          </span>
          <span className="home">
            <a className="home-link" href={PUBLIC_URL} onClick={() => sfx("daveClick")}>
              TAKE ME HOME
            </a>
          </span>
        </div>
        <Dave
          onSummon={addCoin}
          style={{
            position: "fixed",
            top: "68%",
            left: "64%",
            transform: "translate(0, -18%)",
            zIndex: -1,
            opacity: "64%",
          }}
        />
        <Coins coins={coins} />
      </div>

      <div className="app flex crt-scanlines crt-colorsep">
        <TitleUpdater
          selectedPlaylist={selectedPlaylist}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
          appTitle={"TrackOrDie ■ 1994"}
        />
        <div className="sticky-controls crt-scanlines crt-colorsep">
          <div className="controls-row">
            <div className="player-logo">
              <img
                src={PUBLIC_URL + "/tracker.png"}
                alt="Computer running tracker"
                title="Computer running tracker"
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
                  Track<span className="orRed">Or</span>Die'94
                </a>
                <span className="neon-line"></span>
              </h1>
            </div>

            <div className="eq-wrapper crt-scanlines">
              <Equalizer playerRef={player} />
            </div>

            {!selectedPlaylist && (
              <div className="title-container">
                <p className="logo-title crt-scanlines crt-sep">
                  <span className="title-span">░▒▓</span> TRACKER
                  <span className="orRed"> NINJA</span> COLLECTION{" "}
                  <span className="title-span"> ▓▒░</span>
                </p>
              </div>
            )}

            <div className={`seekbar-wrapper ${selectedPlaylist ? "visible" : "hidden"}`}>
              <div className="volume-bar">
                <div className="seek-bar-wrap">
                  <div className="volume-wrapper" style={{ touchAction: "manipulation" }}>
                    <p className="text-4-slider">Vol</p>
                    <input
                      className="audio-bar"
                      title="Blow your speakers away! [▲] / [▼]"
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(volume * 100)}
                      onChange={(e) => setVolume(Number(e.target.value) / 100)}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>

              <div className="progress-and-eq">
                <div className="seek-bar-wrap">
                  <div className="position-wrapper" style={{ touchAction: "manipulation" }}>
                    <p className="text-4-slider">Pos</p>
                    <input
                      className="seek-bar"
                      type="range"
                      title="Find timing of that groovy piece!"
                      min="0"
                      max="1000"
                      value={Math.round(progress * 1000)}
                      onChange={(e) => handleSeek(Number(e.target.value) / 1000)}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`controls-left crt-scanlines ${
                selectedPlaylist ? "visible" : "hidden"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <button
                onClick={handlePrev}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Previous track [◄]"
              >
                <RewindIcon className="correction360px2" />
              </button>
              <button
                onClick={handlePlayPause}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Play/Pause [SPACE]"
                className={isPlaying ? "playing" : "paused"}
              >
                {isPlaying ? (
                  <PauseIcon className="correction360px" />
                ) : (
                  <PlayIcon className="correction360px" />
                )}
              </button>
              <button
                onClick={handleNext}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Next track [►]"
              >
                <FastForwardIcon className="correction360px2" />
              </button>
              <button
                onClick={handleShuffle}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Shuffle toggle [F10]"
                className={isShuffle ? "on" : "off"}
              >
                {isShuffle ? (
                  <ShuffleOnIcon className="correction360px" />
                ) : (
                  <ShuffleOffIcon className="correction360px" />
                )}
              </button>
              <button
                onClick={handleLoop}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Loop toggle [F11]"
                className={isLoop ? "on" : "off"}
              >
                {isLoop ? (
                  <LoopOnIcon className="correction360px" />
                ) : (
                  <LoopOffIcon className="correction360px" />
                )}
              </button>
            </div>
          </div>

          <PlaylistTabs
            selectedPlaylist={selectedPlaylist}
            onSelect={setSelectedPlaylist}
            isSmallScreen={isSmallScreen}
          />
        </div>

        <div className="left-right-wrapper">
          <div className="left crt-scanlines crt-colorsep">
            <div className="power-led">
              POWER LED
              <div className="led" />
            </div>
            <h2>Playlists</h2>

            <ul>
              {playlists.map((pl) => (
                <li
                  key={pl.id}
                  onClick={() => {
                    sfx("clickPl");
                    setSelectedPlaylist(pl);
                  }}
                  onMouseEnter={() => sfx("plHover")}
                  onTouchStart={() => {
                    if (!isSmallScreen) sfx("plHover");
                  }}
                  className={selectedPlaylist?.id === pl.id ? "active" : ""}
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
                  <h1>{selectedPlaylist.name}</h1>
                  <img
                    className="puter"
                    src={PUBLIC_URL + "/Pix/puter.svg"}
                    alt="Vintage puter"
                    width="104"
                    height="104"
                  />
                </div>
                <ul className="tracks">
                  {selectedPlaylist.tracks.map((track, idx) => (
                    <li
                      key={`${selectedPlaylist.id}-${idx}`}
                      onClick={() => {
                        sfx("click");
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

                <Dave onSummon={addCoin} />
                <Coins coins={coins} />
              </>
            ) : (
              <div className="introWrapper">
                <p className="introDescription1">
                  Here you will find all tracker music that were posted on
                  Trackerninja's Tik-Tok channel from 2021 to 2027 wrapped in a
                  nice web GUI app. So, pick your style on the playlist menu and
                  you are good to go.
                </p>
                <p
                  className="introDescription2"
                  onMouseEnter={() => sfx("daveHover")}
                  title="Click me to obtain some coins!"
                  onClick={() => {
                    sfx("daveClick");
                    addCoin();
                  }}
                >
                  UNBLOCK AUDIO RESTRICTIONS FOR THIS WEBSITE TO FULLY ENJOY IT!
                  This web application is intended to run on
                  desktop/laptop/smartphone. That's quite a range of resolutions
                  to say the least, so choose yours and fire up music. F#ck round
                  buttons!!!!
                </p>
                <p className="introDescription5">
                  Startup sound: Neo Geo CD startup jingle
                  <br />
                  Code: Windows 7 x64 ESU, NodeJs 23, VsCode 1.100, RedFox 143
                </p>
                <p className="introDescription6">
                  Startup illustration and audio design:
                </p>
                <p className="introDescription7">
                  <a
                    href="https://stock.adobe.com/contributor/204789995/spacedrone808"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={() => sfx("clickPl")}
                    onClick={() => sfx("daveHover")}
                  >
                    SPACEDRONE808 aka TRACKERNINJA
                  </a>
                  <br />
                  <a
                    className="introDescription1-link"
                    href="https://mega.nz/file/ml4WlBjT#tPOOhOfVFg9BWwLWGCsHs2CCQ3iTnVysqeWMczJacbM"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={() => sfx("clickPl")}
                    onClick={() => sfx("daveHover")}
                  >
                    DOWNLOAD WHOLE MUSIC LIBRARY
                  </a>
                </p>

                <Dave onSummon={addCoin} />
                <Coins coins={coins} />

                <div className="flyout-links-4-mobile">
                  React-based web application is intended to play tracker music
                  by means of
                  <a
                    className="fly-chip-mob"
                    href="https://www.npmjs.com/package/chiptune3"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => sfx("daveClick")}
                  >
                    Chiptune3.js
                  </a>
                  and
                  <a
                    className="fly-mpt-mob"
                    href="https://lib.openmpt.org/libopenmpt/download"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => sfx("daveClick")}
                  >
                    OpenMPT
                  </a>
                  libraries.
                  <br />
                  Proudly brought to you by{" "}
                  <a
                    className="fly-trk-mob"
                    href="https://trackerninja.codeberg.page"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => sfx("daveHover")}
                  >
                    {" "}
                    TrackerNinja
                  </a>
                  in 2025 &copy;
                </div>
              </div>
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
          <DimensionsDetector />
          <StarAnimation />
          <ScrollTop />
          <PowerSwitch ref={powerSwitchRef} />
        </div>

        {!isSmallScreen && (
          <>
            <div
              className="flyout-trigger"
              onMouseEnter={() => sfx("hover")}
              onMouseLeave={() => sfx("unhover")}
            />
            <div className="flyout crt-scanlines crt-colorsep">
              <span className="about">
                ░▒▓ <span className="about-text">ABOUT APP </span> ▓▒░
              </span>
              <p className="flyout-links">
                React-based web application is intended to play tracker music by
                means of
                <a
                  className="fly-chip"
                  href="https://www.npmjs.com/package/chiptune3"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => sfx("daveClick")}
                >
                  Chiptune3.js
                </a>
                and
                <br />
                <a
                  className="fly-mpt"
                  href="https://lib.openmpt.org/libopenmpt/download"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => sfx("daveClick")}
                >
                  OpenMPT
                </a>
                libraries. Proudly brought to you by
                <a
                  className="fly-trk"
                  href="https://trackerninja.codeberg.page"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => sfx("daveHover")}
                >
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
          </>
        )}
      </div>
    </>
  );
}