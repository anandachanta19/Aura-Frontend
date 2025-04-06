import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaPlay } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./PlaylistPage.module.css"; // Import the CSS module

interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: string;
  dateAdded: string;
}

interface Playlist {
  id: string;
  name: string;
  image_url: string;
  songs: Song[];
}

const PlaylistPage: React.FC = () => {
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const playlistId = searchParams.get("playlist_id");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (duration: string) => {
    const seconds = parseInt(duration);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSharePlaylist = () => {
    // Here you would implement your sharing logic
    if (navigator.share) {
      navigator
        .share({
          title: playlist?.name || "Awesome Playlist",
          text: "Check out this awesome playlist I found!",
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => alert("Playlist link copied to clipboard!"))
        .catch(console.error);
    }
  };

  const handlePlayTrack = async (trackId: string) => {
    try {
      const response = await axios.get("http://localhost:8000/api/go/mediaplayer", {
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

  const handlePlayPlaylist = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/go/mediaplayer/", {
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

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchPlaylist = async () => {
      try {
        setLoading(true);
        const response = await axios.get<Playlist>(
          `http://localhost:8000/api/spotify/playlist/`,
          { params: { session: sessionKey, playlist_id: playlistId } }
        );
        setPlaylist(response.data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching playlist:", err);
        setError(err.response?.data?.error || "Failed to fetch playlist.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [sessionKey, playlistId]);

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href="http://localhost:8000/api/spotify/login/">Log in with Spotify</a>
      </div>
    );

  return (
    <div
      className={styles["main-content"]} // Apply CSS module class
      style={{ backgroundImage: `url(${playlist?.image_url})` }}
    >
      <div className={styles["blur-overlay"]}></div>
      <div className={styles["playlist-page"]}>
        <button className={styles["back-button"]} onClick={() => navigate(-1)}>
          Back
        </button>
        <div className={styles["header"]}>
          <div
            className={styles["playlist-artwork"]}
            style={{ backgroundImage: `url(${playlist?.image_url})` }}
          ></div>
          <div className={styles["playlist-info"]}>
            <div className={styles["label"]}>PLAYLIST</div>
            <h1>{playlist?.name}</h1>
            <div className={styles["playlist-controls"]}>
              <button className={styles["control-button"]} onClick={handlePlayPlaylist}>Play</button>
              <button className={styles["control-button"]} onClick={handleSharePlaylist}>Share</button>
            </div>
          </div>
        </div>
        <div className={styles["song-list"]}>
          <table>
            <tbody>
              {playlist?.songs.map((song, index) => (
                <tr key={song.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className={styles["song-info"]}>
                      <div className={styles["song-image-container"]}>
                        <img src={song.albumArt} alt={song.title} />
                        <div className={styles["play-icon-overlay"]} onClick={() => handlePlayTrack(String(song.id))}>
                          <FaPlay className={styles["play-icon"]} />
                        </div>
                      </div>
                      <div>
                        <div className={styles["title"]}>{song.title}</div>
                        <div className={styles["artist"]}>{song.artist}</div>
                      </div>
                    </div>
                  </td>
                  <td>{song.album}</td>
                  <td>{formatDate(song.dateAdded)}</td>
                  <td>{formatDuration(song.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlaylistPage;
