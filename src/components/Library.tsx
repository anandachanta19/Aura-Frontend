import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaFolderOpen, FaPlay } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
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
    console.log("Session Key:", sessionKey); // Debug session key
    if (!sessionKey) {
      console.log("No session key, setting error");
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchLibrary = async () => {
      try {
        setLoading(true);
        console.log("Fetching library data...");
        const response = await axios.get(
          `http://localhost:8000/api/spotify/library/`,
          { params: { session: sessionKey } },
        );
        console.log("API Response:", response.data); // Debug API response
        setRecentTracks(response.data.recently_played || []);
        setPlaylists(response.data.playlists || []);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching library:", err);
        setError(err.response?.data?.error || "Failed to fetch library.");
      } finally {
        setLoading(false);
        console.log("Loading complete, state:", {
          loading,
          error,
          recentTracks,
          playlists,
        });
      }
    };

    fetchLibrary();
  }, [sessionKey]);

  const handleOpenPlaylist = async (playlistId: string) => {
    try {
      const response = await axios.get("http://localhost:8000/api/go/playlist/", {
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

  // Always render the header
  return (
    <div className="library-container">
      <Aurora />
      <div className="header">
        <h2 className="library-title">Your Library</h2>
        <button className="back-button" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && (
        <div className="error">
          <p>Error: {error}</p>
          <a href="http://localhost:8000/api/spotify/login/">
            Log in with Spotify
          </a>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="section">
            <h3>Recently Played</h3>
            <div className="grid-container">
              {recentTracks.length > 0 ? (
                recentTracks.map((track) => (
                  <div className="track-card" key={track.id}>
                    <div className="image-container">
                      <img
                        src={track.album_cover || "/fallback-image.jpg"}
                        alt={track.name}
                        className="track-image"
                      />
                      <div className="overlay">
                        <button className="play-button" aria-label="Play">
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
                        <button className="open-button" aria-label="Open" onClick={() => handleOpenPlaylist(playlist.id)}>
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
        </>
      )}
    </div>
  );
};

export default Library;
