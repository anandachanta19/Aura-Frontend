import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaPlay } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./RecommendSongs.css";
import Aurora from "./ui/Aurora/Aurora";

const RecommendSongs: React.FC = () => {
  // Use sessionStorage to persist songs between navigations
  const [songs, setSongs] = useState<any[]>(() => {
    const savedSongs = sessionStorage.getItem('recommendedSongs');
    return savedSongs ? JSON.parse(savedSongs) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(songs.length === 0);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const navigate = useNavigate();
  const [emotion, setEmotion] = useState<string | null>(() => {
    return sessionStorage.getItem('recommendedEmotion') || null;
  });

  // New state variables for create playlist functionality
  const [showCreatePlaylist, setShowCreatePlaylist] = useState<boolean>(false);
  const [playlistName, setPlaylistName] = useState<string>("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState<boolean>(false);
  const [playlistCreated, setPlaylistCreated] = useState<boolean>(false);
  const [createdPlaylistId, setCreatedPlaylistId] = useState<string | null>(null);
  
  // New state variables for mood changer playlist
  const [showMoodChangerPlaylist, setShowMoodChangerPlaylist] = useState<boolean>(false);
  const [isMoodChanger, setIsMoodChanger] = useState<boolean>(false);

  // Extract this to a separate function so it can be called from multiple places
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const emotion = urlParams.get("emotion");
      const genres = urlParams.get("genres")?.split(',');

      if (!emotion || !genres) {
        setError("Emotion and genres are missing.");
        setLoading(false);
        return;
      }

      setEmotion(emotion);
      sessionStorage.setItem('recommendedEmotion', emotion);

      const response = await axios.post("http://localhost:8000/api/recommend/songs/", {
        emotion,
        genres,
      }, {
        params: { session: sessionKey },
      });
      
      setSongs(response.data.songs);
      // Cache songs in sessionStorage
      sessionStorage.setItem('recommendedSongs', JSON.stringify(response.data.songs));
      setLoading(false);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setError("Failed to fetch recommendations.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    // Only fetch recommendations if we don't have cached songs
    if (songs.length === 0) {
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, [sessionKey, songs.length]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playlistName.trim()) return;

    setIsCreatingPlaylist(true);

    try {
      const trackIds = songs.map(song => song.track_id);
      const response = await axios.post("http://localhost:8000/api/spotify/create-playlist/", {
        name: playlistName,
        track_ids: trackIds,
        is_mood_changer: isMoodChanger, // Pass this flag to the backend
      }, {
        params: { session: sessionKey },
      });

      setCreatedPlaylistId(response.data.playlist_id);
      setPlaylistCreated(true);
      setIsCreatingPlaylist(false);
    } catch (error) {
      console.error("Error creating playlist:", error);
      setIsCreatingPlaylist(false);
      setError("Failed to create playlist.");
    }
  };

  const closePopup = () => {
    setShowCreatePlaylist(false);
    setShowMoodChangerPlaylist(false);
    setPlaylistCreated(false);
    setPlaylistName("");
    setIsMoodChanger(false);
  };

  // Handle "Go Again" to refresh recommendations
  const handleGoAgain = () => {
    // Clear cached songs before fetching new ones
    sessionStorage.removeItem('recommendedSongs');
    fetchRecommendations();
  };

  // Handle mood changer playlist button click
  const handleMoodChangerPlaylist = () => {
    setShowMoodChangerPlaylist(true);
    setIsMoodChanger(true);
  };

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href="http://localhost:8000/api/spotify/login/">Log in with Spotify</a>
      </div>
    );

  return (
    <div className="recommend-songs">
      <Aurora />
      <nav className="about-nav">
        <h2 className="select_title">Recommended Songs</h2>
        <h2 className="select-title" onClick={() => navigate(-1)}>
          Back
        </h2>
      </nav>
      <div className="statement-container">
        <p className="statement">Here are some songs we think you'll love!</p>
      </div>
      <div className="grid-container">
        {songs.map((song, index) => (
          <div key={index} className="track-card">
            <div
              className="image-container"
              onClick={() => navigate(`/mediaplayer?session=${sessionKey}&track_id=${song.track_id}`)}
            >
              <img src={song.image} alt={song.name} className="track-image" />
              <div className="overlay">
                <button className="play-button" aria-label="Play">
                  <FaPlay />
                </button>
              </div>
            </div>
            <div className="track-info">
              <p className="track-name">{song.name.toUpperCase()}</p>
              <p className="track-artist">{song.artist}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="action-buttons">
        <button className="create-playlist" onClick={() => setShowCreatePlaylist(true)}>Create Playlist</button>
        <button className="go-again" onClick={handleGoAgain}>Go Again</button>
        {emotion && ["sad", "angry", "frustrated"].includes(emotion.toLowerCase()) && (
          <button className="mood-changer-playlist" onClick={handleMoodChangerPlaylist}>Mood Changer Playlist</button>
        )}
      </div>

      {/* Create Playlist or Mood Changer Playlist Popup */}
      {(showCreatePlaylist || showMoodChangerPlaylist) && (
        <div className="playlist-popup-overlay">
          <div className="playlist-popup">
            {!playlistCreated ? (
              <form onSubmit={handleCreatePlaylist}>
                <h3>{isMoodChanger ? "Uplift your mood with the mood changer playlist" : "Let's Create...!"}</h3>
                <div className="form-group">
                  <input
                    type="text"
                    id="playlist-name"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder="Enter playlist name"
                    required
                  />
                </div>
                <div className="popup-buttons">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={closePopup}
                    disabled={isCreatingPlaylist}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="create-button"
                    disabled={!playlistName.trim() || isCreatingPlaylist}
                  >
                    {isCreatingPlaylist ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="playlist-success">
                <h3>Playlist Created Successfully!</h3>
                <div className="popup-buttons">
                  <button 
                    type="button" 
                    className="close-button"
                    onClick={closePopup}
                  >
                    Close
                  </button>
                  <button 
                    type="button" 
                    className="go-to-playlist-button"
                    onClick={() => navigate(`/playlist?session=${sessionKey}&playlist_id=${createdPlaylistId}`)}
                  >
                    Go to Playlist
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendSongs;
