import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaHeart, FaList, FaPause, FaPlay,
  FaRandom,
  FaRegHeart,
  FaStepBackward, FaStepForward, FaVolumeMute, FaVolumeUp
} from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import { BACKEND_URL } from "../config/env";
import './MediaPlayer.css';

// Debounce utility function to prevent excessive API calls

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

// Key states for Spotify SDK
const SPOTIFY_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
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
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [initializedQueue, setInitializedQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const lastPositionRef = useRef<number>(0);
  const queueRef = useRef<Track[]>([]);
  const lastTrackIdRef = useRef<string | null>(null);
  
  // Replace complex state tracking with simpler state machine
  const [spotifyState, setSpotifyState] = useState(SPOTIFY_STATE.IDLE);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const scriptLoaded = useRef(false);
  const activeDeviceId = useRef<string | null>(null);
  const pendingPlayRequest = useRef<{trackId: string, position: number} | null>(null);
  const fetchedLyricsTrackIds = useRef<Set<string>>(new Set());
  const lyricsCache = useRef<Map<string, string | null>>(new Map());

  const handleTrackEnded = useCallback(() => {
    const currentId = currentTrack?.id;
    if (!currentId || queueRef.current.length === 0) return;
    
    const currentIndex = queueRef.current.findIndex(track => track.id === currentId);
    if (currentIndex !== -1 && currentIndex < queueRef.current.length - 1) {
      const nextTrack = queueRef.current[currentIndex + 1];
      
      setCurrentTrack(nextTrack);
      lastTrackIdRef.current = nextTrack.id;
      setCurrentTime(0);
      
      setTimeout(() => {
        if (spotifyState === SPOTIFY_STATE.READY) {
          playTrackOnSpotify(nextTrack.id, nextTrack.accessToken)
            .catch(err => {
              console.error("Failed to play next track after current ended:", err);
              
              setTimeout(() => {
                playTrackOnSpotify(nextTrack.id, nextTrack.accessToken)
                  .catch(retryErr => console.error("Retry failed:", retryErr));
              }, 1000);
            });
        }
      }, 100);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [currentTrack, spotifyState]);

  // Keep track of the last playing position to resume from the same spot
  useEffect(() => {
    if (isPlaying) {
      lastPositionRef.current = currentTime;
    }
  }, [currentTime, isPlaying]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const truncateText = (text: string, limit: number) => {
    return text?.length > limit ? text.substring(0, limit) + "..." : text;
  };

  // ---------------------------
  // API calls for track & playlist data with improved queue handling
  // ---------------------------
  const fetchTrackData = useCallback(async (trackId: string) => {
    try {
      setError(null);
      const response = await axios.get(`${BACKEND_URL}/api/spotify/track/`, {
        params: { session: sessionKey, track_id: trackId },
      });
      const track = response.data;

      // Build the new queue with the current track only
      const updatedQueue = [track];
      setQueue(updatedQueue);
      queueRef.current = updatedQueue; // Keep reference in sync
      setCurrentTrack(track);
      lastTrackIdRef.current = track.id;

      // Only try to play if Spotify is ready
      if (spotifyState === SPOTIFY_STATE.READY) {
        await playTrackOnSpotify(track.id, track.accessToken);
      }
    } catch (err) {
      console.error("Failed to fetch track data:", err);
      setError("Failed to load track. Please try again.");
    }
  }, [sessionKey, spotifyState]);

  const fetchPlaylistData = useCallback(async (playlistId: string) => {
    try {
      setError(null);
      const response = await axios.get(`${BACKEND_URL}/api/spotify/playlist/`, {
        params: { session: sessionKey, playlist_id: playlistId },
      });
      const playlistTracks: Track[] = response.data.songs || [];
      if (playlistTracks.length > 0) {
        setQueue(playlistTracks);
        queueRef.current = playlistTracks; // Keep reference in sync
        setCurrentTrack(playlistTracks[0]);
        lastTrackIdRef.current = playlistTracks[0].id;

        // Only try to play if Spotify is ready
        if (spotifyState === SPOTIFY_STATE.READY) {
          await playTrackOnSpotify(playlistTracks[0].id, playlistTracks[0].accessToken);
        }
      } else {
        setError("No tracks found in the playlist.");
      }
    } catch (err) {
      console.error("Failed to fetch playlist data:", err);
      setError("Failed to load playlist. Please try again.");
    }
  }, [sessionKey]);

  // ---------------------------
  // Fetch lyrics once when track changes
  // ---------------------------
  useEffect(() => {
    const fetchLyricsForTrack = async (trackId: string, title: string, artist: string) => {
      // Skip if we already fetched lyrics for this track
      if (fetchedLyricsTrackIds.current.has(trackId)) {
        // Use cached lyrics if available
        const cachedLyrics = lyricsCache.current.get(trackId);
        if (cachedLyrics !== undefined) {
          setLyrics(cachedLyrics);
        }
        return;
      }

      setIsFetchingLyrics(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/api/spotify/lyrics/`, {
          params: {
            session: sessionKey,
            song_title: title,
            artist_name: artist,
          },
        });
        
        // Store result in cache (even if null)
        const fetchedLyrics = response.data.lyrics || null;
        lyricsCache.current.set(trackId, fetchedLyrics);
        fetchedLyricsTrackIds.current.add(trackId);
        
        // Only update the lyrics state if this is still the current track
        if (currentTrack?.id === trackId) {
          setLyrics(fetchedLyrics);
        }
      } catch (err) {
        console.error("Failed to fetch lyrics:", err);
        // Cache the null result to avoid repeated failed requests
        lyricsCache.current.set(trackId, null);
        fetchedLyricsTrackIds.current.add(trackId);
        
        if (currentTrack?.id === trackId) {
          setLyrics(null);
        }
      } finally {
        if (currentTrack?.id === trackId) {
          setIsFetchingLyrics(false);
        }
      }
    };

    // When track changes, fetch lyrics right away
    if (currentTrack) {
      fetchLyricsForTrack(currentTrack.id, currentTrack.title, currentTrack.artist);
    } else {
      setLyrics(null);
    }
  }, [currentTrack, sessionKey]);

  useEffect(() => {
    // This effect now just ensures the UI shows the right lyrics when toggled
    if (showLyrics && currentTrack) {
      // If we've already fetched lyrics for this track, use the cached version
      if (fetchedLyricsTrackIds.current.has(currentTrack.id)) {
        const cachedLyrics = lyricsCache.current.get(currentTrack.id);
        if (cachedLyrics !== undefined) {
          setLyrics(cachedLyrics);
        }
      }
      // Otherwise, the other effect will have already started fetching
    }
  }, [showLyrics, currentTrack]);

  // ---------------------------
  // Initial data fetching based on query params
  // ---------------------------
  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing.");
      return;
    }

    const initializeMediaPlayer = async () => {
      try {
        if (playlistId) {
          await fetchPlaylistData(playlistId);
        } else if (trackId) {
          await fetchTrackData(trackId);
        } else {
          setError("Neither playlist_id nor track_id is provided.");
        }
      } catch (err) {
        console.error("Error initializing media player:", err);
        setError("Failed to initialize player. Please try again.");
      } finally {
        setInitializedQueue(true);
      }
    };

    if (!initializedQueue) {
      initializeMediaPlayer();
    }
  }, [sessionKey, trackId, playlistId, initializedQueue, fetchPlaylistData, fetchTrackData]);

  // ---------------------------
  // Handle clicks outside volume slider
  // ---------------------------
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        volumeSliderRef.current && 
        !volumeSliderRef.current.contains(event.target as Node) &&
        !((event.target as Element).closest('button')?.classList.contains('control-btn'))
      ) {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ---------------------------
  // Simplified Spotify SDK Script Loading
  // ---------------------------
  useEffect(() => {
    if (scriptLoaded.current) return;
    
    const loadSpotifyScript = () => {
      if (!document.getElementById('spotify-player-script')) {
        console.log('Loading Spotify script...');
        const script = document.createElement('script');
        script.id = 'spotify-player-script';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Spotify script loaded');
          scriptLoaded.current = true;
        };
        
        script.onerror = () => {
          console.error('Failed to load Spotify script');
          setSpotifyError('Failed to load Spotify player. Please refresh the page.');
          setSpotifyState(SPOTIFY_STATE.ERROR);
        };
        
        document.body.appendChild(script);
      }
    };
    
    loadSpotifyScript();
  }, []);
  
  // ---------------------------
  // Spotify Player Initialization - Cleaner Approach
  // ---------------------------
  useEffect(() => {
    // Only proceed if we have a valid session and track
    if (!sessionKey || !currentTrack?.accessToken || !scriptLoaded.current) return;
    
    // Don't re-initialize if we're already in a loading or ready state
    if (spotifyState === SPOTIFY_STATE.LOADING || spotifyState === SPOTIFY_STATE.READY) return;
    
    console.log('Initializing Spotify player...');
    setSpotifyState(SPOTIFY_STATE.LOADING);
    
    // Save original method to restore later
    const originalMethod = window.onSpotifyWebPlaybackSDKReady;
    
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('Spotify Web Playback SDK ready');
      
      // Clean up any existing player
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      
      const player = new Spotify.Player({
        name: 'Aura MediaPlayer',
        getOAuthToken: cb => {
          if (currentTrack?.accessToken) {
            cb(currentTrack.accessToken);
          } else {
            setSpotifyError('No access token available.');
            setSpotifyState(SPOTIFY_STATE.ERROR);
          }
        },
        volume: volumeLevel
      });
      
      // Handle ready event - device registered successfully
      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify player ready with device ID:', device_id);
        activeDeviceId.current = device_id;
        setSpotifyState(SPOTIFY_STATE.READY);
        
        // Transfer playback to our device
        handleDeviceActivation(device_id);
      });
      
      // Handle not ready event - device registration issue
      player.addListener('not_ready', ({ device_id }) => {
        console.warn('Spotify player device ID is not ready:', device_id);
        activeDeviceId.current = null;
        setSpotifyState(SPOTIFY_STATE.ERROR);
        setSpotifyError('Spotify player not ready. Please refresh the page.');
      });
      
      // Handle player state changes with improved track end detection
      player.addListener('player_state_changed', state => {
        if (!state) {
          console.warn('Empty player state received');
          return;
        }
        
        // Update UI state
        setIsPlaying(!state.paused);
        
        // Update current time - but first check if this is a reasonable update
        const newPosition = state.position / 1000;
        const lastPosition = lastPositionRef.current;
        
        const isNormalProgression = newPosition >= lastPosition || (newPosition < lastPosition && lastPosition - newPosition < 3);
        
        if (isNormalProgression) {
          setCurrentTime(newPosition);
        }
        
        // Remember position for resume
        if (!state.paused) {
          lastPositionRef.current = newPosition;
        }
        
        // Improved track end detection
        if (state.paused && newPosition === 0 && lastPosition > 0) {
          console.log('Track ended detected from player state');
          
          setTimeout(() => {
            handleTrackEnded();
          }, 300);
        }
        
        // Detect track changes 
        const newTrackId = state.track_window?.current_track?.id;
        if (newTrackId && newTrackId !== lastTrackIdRef.current) {
          console.log('Track changed in player to:', newTrackId);
          lastTrackIdRef.current = newTrackId;
          const updatedTrack = queueRef.current.find(track => track.id === newTrackId);
          
          if (updatedTrack) {
            setCurrentTrack(updatedTrack);
            setCurrentTime(0);
          }
        }
      });
      
      // Error listeners
      player.addListener('initialization_error', ({ message }) => {
        console.error('Initialization error:', message);
        setSpotifyError(`Initialization error: ${message}`);
        setSpotifyState(SPOTIFY_STATE.ERROR);
      });
      
      player.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message);
        setSpotifyError('Authentication error. Please log in again.');
        setSpotifyState(SPOTIFY_STATE.ERROR);
      });
      
      player.addListener('account_error', ({ message }) => {
        console.error('Account error:', message);
        setSpotifyError(message.includes('premium') 
          ? 'Spotify Premium is required for playback.' 
          : `Account error: ${message}`);
        setSpotifyState(SPOTIFY_STATE.ERROR);
      });
      
      player.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message);
        if (message.includes('offline') || message.includes('forbidden')) {
          setSpotifyError(`Playback error: ${message}`);
        }
      });
      
      console.log('Connecting Spotify player...');
      player.connect()
        .then(success => {
          if (success) {
            console.log('Spotify player connected successfully');
            playerRef.current = player;
          } else {
            console.error('Failed to connect Spotify player');
            setSpotifyError('Failed to connect to Spotify. Please refresh and try again.');
            setSpotifyState(SPOTIFY_STATE.ERROR);
          }
        })
        .catch(error => {
          console.error('Error connecting Spotify player:', error);
          setSpotifyError('Connection error. Please refresh and try again.');
          setSpotifyState(SPOTIFY_STATE.ERROR);
        });
    };
    
    if (typeof Spotify !== 'undefined') {
      window.onSpotifyWebPlaybackSDKReady();
    }
    
    return () => {
      window.onSpotifyWebPlaybackSDKReady = originalMethod;
      if (playerRef.current) {
        console.log('Cleaning up player on unmount');
        playerRef.current.disconnect();
        playerRef.current = null;
      }
    };
  }, [currentTrack?.accessToken, sessionKey, scriptLoaded.current]);
  
  useEffect(() => {
    if (spotifyState === SPOTIFY_STATE.READY && pendingPlayRequest.current && currentTrack) {
      console.log('Processing pending play request:', pendingPlayRequest.current);
      const { trackId, position } = pendingPlayRequest.current;
      pendingPlayRequest.current = null;
      playTrackOnSpotify(trackId, currentTrack.accessToken, position);
    }
  }, [spotifyState, currentTrack]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null;

    if (isPlaying && currentTrack) {
      progressInterval = setInterval(() => {
        if (isPlaying) {
          setCurrentTime(prev => {
            const newTime = prev + 0.25;
            
            if (newTime >= currentTrack.duration - 1) {
              console.log('End of track detected by timer, advancing to next track');
              handleTrackEnded();
              return prev;
            }
            
            return newTime < currentTrack.duration ? newTime : prev;
          });
        }
      }, 250);
    }
    
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isPlaying, currentTrack, handleTrackEnded]);

  useEffect(() => {
    const updatePlayerVolume = async () => {
      if (playerRef.current) {
        try {
          await playerRef.current.setVolume(volumeLevel);
          console.log(`Volume set to ${volumeLevel}`);
        } catch (err) {
          console.error('Failed to set volume on player:', err);
          
          if (currentTrack?.accessToken && activeDeviceId.current) {
            try {
              await axios.put(
                'https://api.spotify.com/v1/me/player/volume',
                {},
                {
                  params: {
                    volume_percent: Math.round(volumeLevel * 100),
                    device_id: activeDeviceId.current
                  },
                  headers: {
                    'Authorization': `Bearer ${currentTrack.accessToken}`
                  }
                }
              );
              console.log(`Volume set via API to ${volumeLevel * 100}%`);
            } catch (apiErr) {
              console.error('Failed to set volume via API:', apiErr);
            }
          }
        }
      }
    };
    
    updatePlayerVolume();
  }, [volumeLevel, currentTrack?.accessToken]);

  useEffect(() => {
    if (currentTrack && currentTime >= currentTrack.duration - 0.5 && isPlaying) {
      console.log('Track completed based on duration check, advancing to next');
      handleTrackEnded();
    }
  }, [currentTime, currentTrack?.duration, handleTrackEnded, isPlaying]);

  const handleDeviceActivation = async (deviceId: string) => {
    if (!currentTrack?.accessToken) {
      console.error('Cannot activate device: No access token available');
      return;
    }
    
    try {
      console.log(`Transferring playback to device: ${deviceId}`);
      
      await axios.put(
        'https://api.spotify.com/v1/me/player', 
        {
          device_ids: [deviceId],
          play: false
        },
        {
          headers: { 
            'Authorization': `Bearer ${currentTrack.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Playback transferred successfully');
      
      if (currentTrack && queueRef.current.length > 0) {
        setTimeout(() => {
          console.log('Starting playback after transfer');
          playTrackOnSpotify(currentTrack.id, currentTrack.accessToken);
        }, 500);
      }
    } catch (err: any) {
      console.error('Failed to transfer playback:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setSpotifyError('Spotify session expired. Please log in again.');
      }
    }
  };
  
  const playTrackOnSpotify = async (trackId: string, token: string, position: number = 0) => {
    if (spotifyState !== SPOTIFY_STATE.READY) {
      console.log('Player not ready, queueing play request');
      pendingPlayRequest.current = { trackId, position };
      return;
    }
    
    if (!activeDeviceId.current) {
      console.error('No active device ID');
      setSpotifyError('Playback device not available');
      return;
    }
    
    try {
      console.log(`Playing track ${trackId} at position ${position}s`);
      await axios.put(
        `https://api.spotify.com/v1/me/player/play?device_id=${activeDeviceId.current}`,
        {
          uris: [`spotify:track:${trackId}`],
          position_ms: position * 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Playback started successfully');
      setIsPlaying(true);
    } catch (err: any) {
      console.error('Failed to start playback:', err);
      
      if (err.response?.status === 404) {
        console.log('Device not found (404), attempting to reconnect...');
        setSpotifyState(SPOTIFY_STATE.IDLE);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setSpotifyError('Authentication failed. Please log in again.');
      } else {
        setSpotifyError('Failed to play track. Please try again.');
      }
    }
  };
  
  const playTrack = async () => {
    if (!currentTrack) return;
    
    playTrackOnSpotify(
      currentTrack.id,
      currentTrack.accessToken,
      lastPositionRef.current
    );
  };
  
  const pauseTrack = async () => {
    if (spotifyState !== SPOTIFY_STATE.READY || !activeDeviceId.current || !currentTrack) {
      console.log('Cannot pause: player not ready');
      return;
    }
    
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/pause',
        {},
        {
          params: { device_id: activeDeviceId.current },
          headers: { 'Authorization': `Bearer ${currentTrack.accessToken}` }
        }
      );
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to pause playback:', err);
      setIsPlaying(false);
    }
  };

  const nextTrack = async () => {
    if (!currentTrack || queueRef.current.length === 0) return;
    
    const currentIndex = queueRef.current.findIndex(track => track.id === currentTrack.id);
    if (currentIndex === -1) return;
    
    const nextIndex = (currentIndex + 1) % queueRef.current.length;
    const nextTrack = queueRef.current[nextIndex];
    
    setCurrentTrack(nextTrack);
    playTrackOnSpotify(nextTrack.id, nextTrack.accessToken);
  };
  
  const previousTrack = async () => {
    if (!currentTrack || queueRef.current.length === 0) return;
    
    const currentIndex = queueRef.current.findIndex(track => track.id === currentTrack.id);
    if (currentIndex === -1) return;
    
    const prevIndex = (currentIndex - 1 + queueRef.current.length) % queueRef.current.length;
    const prevTrack = queueRef.current[prevIndex];
    
    setCurrentTrack(prevTrack);
    playTrackOnSpotify(prevTrack.id, prevTrack.accessToken);
  };
  
  const seekPlayback = async (position: number) => {
    if (spotifyState !== SPOTIFY_STATE.READY || !activeDeviceId.current || !currentTrack) {
      console.log('Cannot seek: player not ready');
      return;
    }
    
    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/seek',
        {},
        {
          params: { 
            position_ms: position * 1000, 
            device_id: activeDeviceId.current 
          },
          headers: { 'Authorization': `Bearer ${currentTrack.accessToken}` }
        }
      );
      setCurrentTime(position);
      lastPositionRef.current = position;
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  };
  
  const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseInt(e.target.value, 10);
    seekPlayback(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const playQueueFromTrack = async (trackId: string) => {
    const trackIndex = queue.findIndex(track => track.id === trackId);
    if (trackIndex === -1) {
      console.error("Track not found in queue.");
      return;
    }
    
    if (currentTrack?.id === trackId) return;
    
    try {
      const selectedTrack = queue[trackIndex];
      setCurrentTrack(selectedTrack);
      lastPositionRef.current = 0;
      
      if (spotifyState === SPOTIFY_STATE.READY && activeDeviceId.current) {
        await playTrackOnSpotify(selectedTrack.id, selectedTrack.accessToken);
        setIsPlaying(true);
        setCurrentTime(0);
      }
    } catch (err) {
      console.error("Failed to play track from queue:", err);
    }
  };

  const toggleQueueOverlay = () => {
    setShowQueueOverlay(!showQueueOverlay);
  };

  const shuffleQueue = () => {
    if (queue.length <= 1) return;
    
    const shuffledQueue = [...queue];
    
    let currentTrackItem = null;
    if (currentTrack) {
      const currentIndex = shuffledQueue.findIndex(track => track.id === currentTrack.id);
      if (currentIndex !== -1) {
        currentTrackItem = shuffledQueue.splice(currentIndex, 1)[0];
      }
    }
    
    for (let i = shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
    }
    
    if (currentTrackItem) {
      shuffledQueue.unshift(currentTrackItem);
    }
    
    setQueue(shuffledQueue);
    queueRef.current = shuffledQueue;
    console.log("Queue shuffled.");
  };

  const handleProgressUpdate = useCallback(() => {
    if (!currentTrack) return;
    
    // Calculate the progress percentage
    const progressPercent = (currentTime / currentTrack.duration) * 100;
    
    // Find the progress bar element and set the CSS variable
    const progressBar = document.querySelector('.progress-bar') as HTMLElement;
    if (progressBar) {
      progressBar.style.setProperty('--progress-percent', `${progressPercent}%`);
    }
  }, [currentTime, currentTrack]);

  useEffect(() => {
    handleProgressUpdate();
  }, [currentTime, handleProgressUpdate]);

  return (
    <div
      className="App"
      style={{
        backgroundImage: currentTrack?.albumArt ? `url(${currentTrack.albumArt})` : 'none',
      }}
    >
      <div className="blur-overlay"></div>
      {(error || spotifyError) && (
        <div className="error-message" style={{position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255, 0, 0, 0.7)', padding: '10px', borderRadius: '5px', color: 'white', zIndex: 1000}}>
          {error || spotifyError}
          <button 
            onClick={() => {
              setError(null);
              setSpotifyError(null);
            }}
            style={{marginLeft: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer'}}
          >
            ×
          </button>
        </div>
      )}
      
      {spotifyState === SPOTIFY_STATE.LOADING && (
        <div className="status-message" style={{position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0, 0, 0, 0.7)', padding: '10px', borderRadius: '5px', color: 'white', zIndex: 1000}}>
          Connecting to Spotify...
        </div>
      )}
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
              <h1 className="track-title">
                {truncateText(currentTrack.title, 20)}
              </h1>
              <h2 className="track-artist">
                {truncateText(currentTrack.artist, 30)}
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
              <div ref={volumeSliderRef} className="volume-slider-wrapper visible">
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