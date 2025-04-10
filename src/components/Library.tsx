import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { FaFolderOpen, FaPlay } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config/env";
import "./Library.css";
import Aurora from "./ui/Aurora/Aurora";

interface Track {
  id: string;
  name: string;
  artist: string;
  album_cover: string | null;
}

interface Playlist {
  id: string;
  name: string;
  image_url: string | null;
}

const Library: React.FC = () => {
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchLibrary = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${BACKEND_URL}/api/spotify/library/`,
          { params: { session: sessionKey } }
        );
        setRecentTracks(response.data.recently_played || []);
        setPlaylists(response.data.playlists || []);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch library.");
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [sessionKey]);

  // Filter out duplicate tracks by ID
  const uniqueRecentTracks = useMemo(() => {
    const trackIds = new Set();
    return recentTracks.filter(track => {
      if (trackIds.has(track.id)) {
        return false;
      }
      trackIds.add(track.id);
      return true;
    });
  }, [recentTracks]);

  // Handler for playing a track
  const handlePlayTrack = async (trackId: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/go/mediaplayer/`, {
        params: { track_id: trackId, session: sessionKey },
      });
      const redirectUrl = response.data.redirect_url;
      if (redirectUrl) {
        // Redirect the browser to the media player page.
        window.location.href = redirectUrl;
      }
    } catch (err: any) {
      console.error("Error fetching track redirect URL:", err);
      setError("Failed to redirect to the media player.");
    }
  };

  // Handler for opening a playlist (unchanged)
  const handleOpenPlaylist = async (playlistId: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/go/playlist/`, {
        params: { playlist_id: playlistId, session: sessionKey },
      });
      const redirectUrl = response.data.redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (err: any) {
      console.error("Error fetching playlist redirect URL:", err);
      setError("Failed to redirect to the playlist.");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href={`${BACKEND_URL}/api/spotify/login/`}>
          Log in with Spotify
        </a>
      </div>
    );

  return (
    <div className="library-container">
      <Aurora />
      <div className="header">
        <h2 className="library-title">Your Library</h2>
        <h2 className="library-title" onClick={() => navigate(-1)}>
          Back
        </h2>
      </div>

      <div className="section">
        <h3>Recently Played</h3>
        <div className="grid-container">
          {uniqueRecentTracks.length > 0 ? (
            uniqueRecentTracks.map((track) => (
              <div className="track-card" key={track.id}>
                <div className="image-container">
                  <img
                    src={track.album_cover || "/fallback-image.jpg"}
                    alt={track.name}
                    className="track-image"
                  />
                  <div className="overlay">
                    <button
                      className="play-button"
                      aria-label="Play"
                      onClick={() => handlePlayTrack(track.id)}
                    >
                      <FaPlay />
                    </button>
                  </div>
                </div>
                <div className="track-info">
                  <p className="track-name">{track.name.toUpperCase()}</p>
                  <p className="track-artist">{track.artist}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No recently played tracks available.</p>
          )}
        </div>
      </div>

      <div className="section">
        <h3>Your Playlists</h3>
        <div className="grid-container">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <div className="playlist-card" key={playlist.id}>
                <div className="image-container">
                  <img
                    src={playlist.image_url || "/fallback-image.jpg"}
                    alt={playlist.name}
                    className="playlist-image"
                  />
                  <div className="overlay">
                    <button
                      className="open-button"
                      aria-label="Open"
                      onClick={() => handleOpenPlaylist(playlist.id)}
                    >
                      <FaFolderOpen />
                    </button>
                  </div>
                </div>
                <p className="playlist-name">
                  {playlist.name.toUpperCase()}
                </p>
              </div>
            ))
          ) : (
            <p>No playlists available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Library;
