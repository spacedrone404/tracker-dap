import React, { useEffect, useRef } from "react";

export default function TitleUpdater({
  selectedPlaylist,
  currentTrackIndex,
  isPlaying,
  appTitle = "TrackOrDie ? 94",
}) {
  const initialTitleRef = useRef(
    typeof document !== "undefined" ? document.title : appTitle
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const trackName =
      selectedPlaylist?.tracks?.[currentTrackIndex]?.name ?? null;

    if (trackName) {
      document.title = `${trackName}`;
    } else {
      // fallback to app title if no track is selected
      document.title = appTitle;
    }
  }, [selectedPlaylist, currentTrackIndex, isPlaying, appTitle]);

  // restore original title on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.title = initialTitleRef.current;
      }
    };
  }, []);

  return null; // invisible UI-only component
}
