import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import Aurora from "../components/ui/Aurora/Aurora";
import './EmotionSelection.css';

const emotions = [
  { name: 'Happy', emoji: '😊', color: '#FFD700' },
  { name: 'Sad', emoji: '😢', color: '#1E90FF' },
  { name: 'Angry', emoji: '😠', color: '#FF4500' },
  { name: 'Surprise', emoji: '😲', color: '#FFA500' },
  { name: 'Excited', emoji: '🤩', color: '#FF69B4' },
  { name: 'Calm', emoji: '😌', color: '#32CD32' },
];

const genres = ['Pop', 'Rock', 'Jazz', 'Classical', 'Hip-Hop', 'Electronic'];

const EmotionSelection: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [sessionKey]);

  const handleGenreClick = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleRecommendSongs = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/recommend_songs/', {
        emotion: selectedEmotion,
        genres: selectedGenres,
        // session: "your_session_key_here" // Uncomment and add if needed
      });
      setRecommendations(response.data.songs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
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
    <div className="emotion-selection-container">
      <Aurora />
      <div className="emotion-selection">
        <nav className="about-nav">
          <h2 className="select_title">Select Emotion</h2>
          <h2 className="select-title" onClick={() => navigate(-1)}>
            Back
          </h2>
        </nav>

        <p>Select your current emotion and preferred genre.</p>
        
        <div className="selections">
          <div className="emotion-section">
            <h3>Emotion</h3>
            <div className="emotion-list">
              {emotions.map(emotion => (
                <div
                  key={emotion.name}
                  className={`emotion-item ${selectedEmotion === emotion.name ? 'selected' : ''}`}
                  style={{ '--emotion-color': emotion.color } as React.CSSProperties}
                  onClick={() => setSelectedEmotion(emotion.name)}
                >
                  <span className="emoji">{emotion.emoji}</span>
                  <span className="name">{emotion.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="genre-section">
            <h3>Genre</h3>
            <div className="genre-list">
              {genres.map(genre => (
                <div
                  key={genre}
                  className={`genre-item ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                  onClick={() => handleGenreClick(genre)}
                >
                  {genre}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          className="generate-button"
          disabled={!selectedEmotion || selectedGenres.length === 0}
          onClick={handleRecommendSongs}
        >
          Recommend Songs
        </button>

        {recommendations.length > 0 && (
          <div className="recommendations">
            <h3>Recommended Songs</h3>
            <ul>
              {recommendations.map((song, index) => (
                <li key={index}>
                  {song.name} by {song.artist} (Album: {song.album})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmotionSelection;