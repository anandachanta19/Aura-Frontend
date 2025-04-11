import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from "react-router-dom";
import Aurora from "../components/ui/Aurora/Aurora";
import { BACKEND_URL } from "../config/env";
import './EmotionSelection.css';
// Import React Icons
import { FaRegAngry, FaRegSadTear, FaRegSmile, FaRegSurprise } from 'react-icons/fa';
import { RiEmotionHappyLine, RiEmotionNormalLine } from 'react-icons/ri';

const emotions = [
  { name: 'Happy', emoji: <FaRegSmile />, color: '#FFD700' },
  { name: 'Sad', emoji: <FaRegSadTear />, color: '#1E90FF' },
  { name: 'Angry', emoji: <FaRegAngry />, color: '#FF4500' },
  { name: 'Surprise', emoji: <FaRegSurprise />, color: '#FFA500' },
  { name: 'Excited', emoji: <RiEmotionHappyLine />, color: '#FF69B4' },
  { name: 'Calm', emoji: <RiEmotionNormalLine />, color: '#32CD32' },
];

const emotionGenreMapping: Record<string, string[]> = {
  Happy: ["Pop", "Dance", "Electronic", "Funk", "Disco"],
  Sad: ["Acoustic", "Blues", "Classical", "Soul", "Folk"],
  Angry: ["Metal", "Rock", "Punk", "Hardcore", "Grunge"],
  Surprise: ["Indie", "Alternative", "Experimental", "Psychedelic"],
  Excited: ["Hip-Hop", "Rap", "Party", "Trap", "Reggaeton"],
  Calm: ["Ambient", "Chill", "Jazz", "Lo-Fi", "New-Age"],
};

const EmotionSelection: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);

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
      const response = await axios.post("http://localhost:8000/api/go/recommend/songs/", {
        emotion: selectedEmotion,
        genres: selectedGenres,
      }, {
        params: { session: sessionKey },
      });
      const data = response.data;
      if (data.redirect_url) {
        window.location.href = `${data.redirect_url}&emotion=${encodeURIComponent(selectedEmotion || '')}&genres=${encodeURIComponent(selectedGenres.join(','))}`;
      } else if (data.recommendations) {
        setRecommendations(data.recommendations);
      } else {
        setError(data.error || "Failed to navigate.");
      }
    } catch (error) {
      console.error("Error navigating to Recommend Songs:", error);
      setError("Failed to get recommendations. Please try again.");
    }
  };

  const genres = selectedEmotion ? emotionGenreMapping[selectedEmotion] || [] : [];

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href={`${BACKEND_URL}/api/spotify/login/`}>Log in with Spotify</a>
      </div>
    );

  return (
    <div className="emotion-selection-container">
      <Aurora />
      <div className="emotion-selection">
        <nav className="about-nav">
          <h2 className="select_title">Select Emotion</h2>
          <h2 className="select-title" onClick={() => window.history.back()}>
            Back
          </h2>
        </nav>
        <div className='emotion-selection-div'>
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
                    <span className="emoji" style={{ fontSize: '1.5rem' }}>{emotion.emoji}</span>
                    <span className="name">{emotion.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedEmotion && (
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
            )}
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
    </div>
  );
};

export default EmotionSelection;