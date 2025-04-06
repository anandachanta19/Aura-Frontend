import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import {
  FaHeart, FaList, FaPause, FaPlay,
  FaRandom,
  FaRegHeart,
  FaStepBackward, FaStepForward, FaVolumeMute, FaVolumeUp
} from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import './MediaPlayer.css';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string | null;
  duration: number; // in seconds
  accessToken: string; // Spotify access token
};

function MediaPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const [volumeLevel, setVolume] = useState(1); // 0 to 1
  const [isLiked, setIsLiked] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const trackId = searchParams.get("track_id");
  const playlistId = searchParams.get("playlist_id");
  const playerRef = useRef<Spotify.Player | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [showQueueOverlay, setShowQueueOverlay] = useState(false);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false); // Add state for fetching lyrics
  // This flag ensures we only adjust the queue once when navigating between playlists and songs.
  const [initializedQueue, setInitializedQueue] = useState(false);

  const truncateText = (text: string, limit: number) => {
    return text.length > limit ? text.substring(0, limit) + "..." : text;
  };

  // ---------------------------
  // API calls for track & playlist data
  // ---------------------------
  const fetchTrackData = async (trackId: string) => {
    try {
      const response = await axios.get("http://localhost:8000/api/spotify/track/", {
        params: { session: sessionKey, track_id: trackId },
      });
      const track = response.data;

      // Build the new queue with the current track only
      const updatedQueue = [track];
      setQueue(updatedQueue);
      setCurrentTrack(updatedQueue[0]);

      if (playerRef.current) {
        await playSelectedTrack(track.id, track.accessToken);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Failed to fetch track data:", err);
    }
  };

  const fetchPlaylistData = async (playlistId: string) => {
    try {
      const response = await axios.get("http://localhost:8000/api/spotify/playlist/", {
        params: { session: sessionKey, playlist_id: playlistId },
      });
      const playlistTracks: Track[] = response.data.songs || [];
      if (playlistTracks.length > 0) {
        setQueue(playlistTracks);
        setCurrentTrack(playlistTracks[0]);

        if (playerRef.current) {
          await playSelectedTrack(playlistTracks[0].id, playlistTracks[0].accessToken);
          setIsPlaying(true);
        }
      } else {
        console.error("No tracks found in the playlist.");
      }
    } catch (err) {
      console.error("Failed to fetch playlist data:", err);
    }
  };

  useEffect(() => {
    // Only proceed if we have both a player and a current track
    if (playerRef.current && currentTrack && initializedQueue) {
      playSelectedTrack(currentTrack.id, currentTrack.accessToken)
        .then(() => setIsPlaying(true))
        .catch(err => console.error("Failed to play track:", err));
    }
  }, [playerRef.current, currentTrack, initializedQueue]);

  // ---------------------------
  // Lyrics fetching
  // ---------------------------
  const fetchLyrics = async (trackTitle: string, trackArtist: string) => {
    setIsFetchingLyrics(true); // Start fetching
    try {
      const response = await axios.get("http://localhost:8000/api/spotify/lyrics/", {
        params: {
          session: sessionKey,
          song_title: trackTitle,
          artist_name: trackArtist,
        },
      });
      if (response.data.lyrics) {
        setLyrics(response.data.lyrics);
      } else {
        setLyrics(null);
      }
    } catch (err) {
      console.error("Failed to fetch lyrics:", err);
      setLyrics(null);
    } finally {
      setIsFetchingLyrics(false); // Stop fetching
    }
  };

  // ---------------------------
  // Initial data fetching based on query params
  // ---------------------------
  useEffect(() => {
    if (!sessionKey) {
      console.error("Session key is missing.");
      return;
    }

    const initializeMediaPlayer = async () => {
      try {
        if (playlistId) {
          await fetchPlaylistData(playlistId);
        } else if (trackId) {
          await fetchTrackData(trackId);
        } else {
          console.error("Neither playlist_id nor track_id is provided.");
        }
      } catch (err) {
        console.error("Error initializing media player:", err);
      } finally {
        setInitializedQueue(true);
      }
    };

    if (!initializedQueue) {
      initializeMediaPlayer();
    }
  }, [sessionKey, trackId, playlistId, initializedQueue]);

  // ---------------------------
  // Update lyrics when toggled
  // ---------------------------
  useEffect(() => {
    if (showLyrics && currentTrack) {
      fetchLyrics(currentTrack.title, currentTrack.artist);
    }
  }, [showLyrics, currentTrack]);

  // ---------------------------
  // Spotify Player Initialization (only once)
  // ---------------------------
  useEffect(() => {
    // Only initialize if sessionKey and currentTrack.accessToken are available.
    if (!sessionKey || !currentTrack?.accessToken) return;
    if (playerRef.current) return; // Prevent reinitialization

    // Check if the Spotify SDK script is already loaded.
    if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: "Aura MediaPlayer",
        getOAuthToken: cb => cb(currentTrack.accessToken),
        volume: volumeLevel,
      });

      player.addListener("ready", ({ device_id }) => {
        console.log("Spotify Player is ready with Device ID:", device_id);
        transferPlaybackToDevice(device_id);
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.warn("Spotify Player is not ready. Device ID:", device_id);
      });

      player.addListener("player_state_changed", state => {
        if (!state) return;
        setIsPlaying(!state.paused);
        setCurrentTime(state.position / 1000);

        // Check if track has ended
        if (state.position === 0 && state.paused) {
          // Find next track in queue
          const currentIndex = queue.findIndex(track => track.id === currentTrack?.id);
          if (currentIndex < queue.length - 1) {
            // Play next track
            const nextTrack = queue[currentIndex + 1];
            setCurrentTrack(nextTrack);
            playSelectedTrack(nextTrack.id, nextTrack.accessToken);
          } else {
            // No more tracks, stay paused
            setIsPlaying(false);
          }
        }

        // Handle track changes
        const newTrackId = state.track_window?.current_track?.id;
        if (newTrackId && newTrackId !== currentTrack?.id) {
          console.log("Track changed to:", newTrackId);
        }
      });

      player.addListener("initialization_error", ({ message }) => {
        console.error("Initialization error:", message);
      });
      player.addListener("authentication_error", ({ message }) => {
        console.error("Authentication error:", message);
      });
      player.addListener("account_error", ({ message }) => {
        console.error("Account error:", message);
      });
      player.addListener("playback_error", ({ message }) => {
        console.error("Playback error:", message);
      });

      player.connect().then(success => {
        if (success) {
          console.log("Spotify Player connected successfully.");
        } else {
          console.error("Failed to connect Spotify Player.");
        }
      });

      playerRef.current = player;
    };

    return () => {
      if (playerRef.current) {
        console.log("Cleaning up Spotify Player...");
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [sessionKey, currentTrack?.accessToken]);

  // ---------------------------
  // Update volume separately
  // ---------------------------
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(volumeLevel);
    }
  }, [volumeLevel]);

  // ---------------------------
  // Playback control functions
  // ---------------------------
  const transferPlaybackToDevice = async (deviceId: string) => {
    if (!currentTrack) {
      console.error("No track is currently loaded.");
      return;
    }
    try {
      await axios.put(
        "https://api.spotify.com/v1/me/player",
        { device_ids: [deviceId], play: true },
        { headers: { Authorization: `Bearer ${currentTrack.accessToken}` } }
      );
      console.log("Playback transferred to device:", deviceId);
    } catch (err) {
      console.error("Failed to transfer playback:", err);
    }
  };

  const seekPlayback = async (position: number) => {
    if (!playerRef.current) {
      console.error("Player is not initialized.");
      return;
    }
    try {
      await playerRef.current.seek(position * 1000);
      setCurrentTime(position);
      console.log(`Playback position set to ${position} seconds.`);
    } catch (err) {
      console.error("Failed to seek playback:", err);
    }
  };

  const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseInt(e.target.value, 10);
    seekPlayback(newTime);
  };

  const playSelectedTrack = async (trackId: string, token: string) => {
    try {
      await axios.put(
        "https://api.spotify.com/v1/me/player/play",
        { uris: [`spotify:track:${trackId}`] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Started playback for track:", trackId);
    } catch (err) {
      console.error("Failed to start playback for selected track:", err);
    }
  };

  const playTrack = async () => {
    if (!playerRef.current || !currentTrack) {
      console.error("Player not initialized or no track loaded.");
      return;
    }
    try {
      await playSelectedTrack(currentTrack.id, currentTrack.accessToken);
      setIsPlaying(true);
      console.log("Playback resumed.");
    } catch (err) {
      console.error("Failed to resume playback:", err);
    }
  };

  const pauseTrack = async () => {
    if (!playerRef.current) {
      console.error("Player not initialized.");
      return;
    }
    try {
      await playerRef.current.pause();
      setIsPlaying(false);
      console.log("Playback paused.");
    } catch (err) {
      console.error("Failed to pause playback:", err);
    }
  };

  const nextTrack = async () => {
    if (!queue.length || !currentTrack) {
      console.error("Queue is empty or no current track.");
      return;
    }
    const currentIndex = queue.findIndex(track => track.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    const nextTrack = queue[nextIndex];

    setCurrentTrack(nextTrack);

    if (playerRef.current) {
      await playSelectedTrack(nextTrack.id, nextTrack.accessToken);
      setIsPlaying(true);
    }
  };

  const previousTrack = async () => {
    if (!queue.length || !currentTrack) {
      console.error("Queue is empty or no current track.");
      return;
    }
    const currentIndex = queue.findIndex(track => track.id === currentTrack.id);
    const previousIndex = (currentIndex - 1 + queue.length) % queue.length;
    const previousTrack = queue[previousIndex];

    setCurrentTrack(previousTrack);

    if (playerRef.current) {
      await playSelectedTrack(previousTrack.id, previousTrack.accessToken);
      setIsPlaying(true);
    }
  };


  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // When a track is selected from the queue (e.g., from the playlist overlay)
  const playQueueFromTrack = async (trackId: string) => {
    const trackIndex = queue.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      console.error("Track not found in queue.");
      return;
    }
    if (currentTrack?.id === trackId) return;
    const reorderedQueue = [...queue.slice(trackIndex), ...queue.slice(0, trackIndex)];
    setQueue(reorderedQueue);
    setCurrentTrack(reorderedQueue[0]);

    if (playerRef.current && reorderedQueue[0]) {
      await playSelectedTrack(reorderedQueue[0].id, reorderedQueue[0].accessToken);
      setIsPlaying(true);
    }
  };

  const toggleQueueOverlay = () => {
    setShowQueueOverlay(!showQueueOverlay);
  };

  const shuffleQueue = () => {
    if (queue.length > 1) {
      const shuffledQueue = [...queue];
      for (let i = shuffledQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
      }
      setQueue(shuffledQueue);
      setCurrentTrack(shuffledQueue[0]);
      console.log("Queue shuffled.");
    }
  };

  // ---------------------------
  // Auto-update time counter when playing
  // ---------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  return (
    <div
      className="App"
      style={{
        backgroundImage: currentTrack?.albumArt ? `url(${currentTrack.albumArt})` : 'none',
      }}
    >
      <div className="blur-overlay"></div>
      <div
        className={`player-container ${showLyrics ? 'lyrics-active' : ''}`}>
        <div className="controls-wrapper">
          {currentTrack && (
            <>
              <img 
                src={currentTrack.albumArt || "/fallback-image.jpg"} 
                alt="Album Art" 
                className="album-art" 
              />
              <h1 className="track-title one-line">
                {currentTrack.title}
              </h1>
              <h2 className="track-artist one-line">
                {currentTrack.artist}
              </h2>
            </>
          )}
          <div className="lyrics-like-container">
            
          <button 
              className="control-btn" 
              onClick={shuffleQueue}
            >
              <FaRandom size={24} color="white" />
            </button>
            <button 
              className="control-btn lyrics-btn" 
              onClick={() => setShowLyrics(!showLyrics)}
            >
              Lyrics
            </button>
            <button 
              className="control-btn" 
              onClick={() => setIsLiked(!isLiked)}
            >
              {isLiked ? <FaHeart size={24} color="white" /> : <FaRegHeart size={24} color="white" />}
            </button>
          </div>
          <div className="time-bar-container">
            <span className="elapsed-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={currentTrack?.duration || 0}
              value={currentTime}
              onChange={handleProgressBarChange}
              className="progress-bar"
            />
            <span className="remaining-time">
              -{currentTrack ? formatTime(currentTrack.duration - currentTime) : "0:00"}
            </span>
          </div>
          <div className="controls">
            <button className="control-btn" onClick={toggleQueueOverlay}>
              <FaList size={22} />
            </button>
            <button className="control-btn" onClick={previousTrack}>
              <FaStepBackward size={22} />
            </button>
            <button className="control-btn" onClick={isPlaying ? pauseTrack : playTrack}>
              {isPlaying ? <FaPause size={22} /> : <FaPlay size={22} />}
            </button>
            <button className="control-btn" onClick={nextTrack}>
              <FaStepForward size={22} />
            </button>
            <button className="control-btn" onClick={() => setShowVolumeSlider(!showVolumeSlider)}>
              {volumeLevel === 0 ? <FaVolumeMute size={24} /> : <FaVolumeUp size={24} />}
            </button>
            {showVolumeSlider && (
              <div className="volume-slider-wrapper visible">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumeLevel}
                  onChange={handleVolumeChange}
                  className="volume-slider vertical"
                />
              </div>
            )}
          </div>
        </div>
        {showLyrics && (
          <div className="lyrics-container">
            {isFetchingLyrics ? (
              <div className="searching-lyrics">Searching for lyrics...</div>
            ) : lyrics ? (
              <pre>{lyrics}</pre>
            ) : (
              <div className="searching-lyrics">No lyrics found.</div>
            )}
          </div>
        )}
        {showQueueOverlay && (
          <div className="queue-overlay">
            <h2>Queue</h2>
            <ul>
              {queue.map(track => (
                <li key={track.id} className="queue-item" onClick={() => playQueueFromTrack(track.id)}>
                  <img 
                    src={track.albumArt || "/fallback-image.jpg"} 
                    alt="Album Art" 
                    className="queue-album-art" 
                  />
                  <div className="queue-track-info">
                    <span className="queue-track-title">{track.title}</span>
                    <span className="queue-track-artist">{track.artist}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button className="close-queue-btn" onClick={toggleQueueOverlay}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaPlayer;
