import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./RecommendSongs.css";
import Aurora from "./ui/Aurora/Aurora";
import { FaPlay } from "react-icons/fa";

const RecommendSongs: React.FC = () => {
  const [songs, setSongs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const navigate = useNavigate();
  const [emotion, setEmotion] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const emotion = urlParams.get("emotion");
    const genres = urlParams.get("genres")?.split(',');

    if (!emotion || !genres) {
      setError("Emotion and genres are missing.");
      setLoading(false);
      return;
    }

    setEmotion(emotion); // Save the detected emotion

    const fetchRecommendations = async () => {
      try {
        const response = await axios.post("http://localhost:8000/api/recommend/songs/", {
          emotion,
          genres,
        }, {
          params: { session: sessionKey },
        });
        setSongs(response.data.songs);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        setError("Failed to fetch recommendations.");
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [sessionKey]);

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
        <button className="create-playlist">Create Playlist</button>
        <button className="go-again" onClick={() => navigate(-1)}>Go Again</button>
        {emotion && ["sad", "angry", "frustrated"].includes(emotion.toLowerCase()) && (
          <button className="mood-changer-playlist">Mood Changer Playlist</button>
        )}
      </div>
    </div>
  );
};

export default RecommendSongs;
