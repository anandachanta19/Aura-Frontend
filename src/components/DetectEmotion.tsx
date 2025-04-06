import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Webcam from "react-webcam";
import "./DetectEmotion.css";
import Aurora from "./ui/Aurora/Aurora";

const genres = ['Pop', 'Rock', 'Jazz', 'Classical', 'Hip-Hop', 'Electronic'];

const DetectEmotion: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const webcamRef = useRef<Webcam>(null);
  const navigate = useNavigate();
  const emotionCount = useRef<Record<string, number>>({
    happy: 0,
    angry: 0,
    sad: 0,
    surprised: 0,
    neutral: 0,
    fearful: 0,
  });

  // Detect emotion from webcam
  const detectEmotion = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc || !sessionKey) return; // Ensure sessionKey is available

    try {
      const response = await axios.post("http://localhost:8000/api/detect/emotion/", {
        image: imageSrc,
      }, {
        params: { session: sessionKey }, // Pass session key as a query parameter
      });
      const frameEmotions = response.data;

      if ("error" in frameEmotions) {
        console.error("Error from detect_emotion:", frameEmotions.error);
        return;
      }

      Object.keys(frameEmotions).forEach((key) => {
        const mappedKey = key === "surprise" ? "surprised" : key === "fear" ? "fearful" : key;
        if (mappedKey in emotionCount.current) {
          emotionCount.current[mappedKey] += frameEmotions[key];
        }
      });
      console.log("Cumulative emotion count:", emotionCount.current);
    } catch (error) {
      console.error("Error in detectEmotion:", error);
    }
  };

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(false);
    handleCaptureFace(); // Start capturing face immediately
  }, [sessionKey]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDetecting) {
      interval = setInterval(detectEmotion, 500);
      setTimeout(async () => {
        clearInterval(interval);
        setIsDetecting(false);

        try {
          const response = await axios.post("http://localhost:8000/api/get/dominant/emotion/", {
            emotion_count: emotionCount.current}, {
              params: { session: sessionKey }, // Pass session key as a query parameter
            });
          const data = response.data;
          if ("error" in data) {
            throw new Error(data.error);
          }
          const dominantEmotion = data.dominant_emotion;
          setDetectedEmotion(dominantEmotion);
          setSelectedGenres([]);
          setRecommendations([]);
        } catch (error) {
          console.error("Error getting dominant emotion:", error);
          setDetectedEmotion("Error detecting emotion");
        }
      }, 10000); // 10 seconds
    }
    return () => clearInterval(interval);
  }, [isDetecting]);
  
  const handleCaptureFace = () => {
    if (!isDetecting) {
      setDetectedEmotion(null);
      emotionCount.current = { happy: 0, angry: 0, sad: 0, surprised: 0, neutral: 0, fearful: 0 };
      setIsDetecting(true);
    }
  };

  const handleGenreClick = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleRecommendSongs = () => {
    setRecommendations([
      { name: "Song 1", artist: "Artist 1", album: "Album 1" },
      { name: "Song 2", artist: "Artist 2", album: "Album 2" },
    ]);
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
    <div className="DetectEmotion">
      <Aurora />
      <nav className="about-nav">
          <h2 className="select_title">Capture Emotion</h2>
          <h2 className="select-title" onClick={() => navigate(-1)}>
            Back
          </h2>
      </nav>
      {isDetecting && (
        <div className="webcam-container">
          <Webcam
            ref={webcamRef}
            audio={false}
            width={320}
            height={240}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
          />
        </div>
      )}
      {detectedEmotion && (
        <div className="result">
          <p className="emotion-result">Detected Emotion: {detectedEmotion}</p>
          <div className="genre-section">
            <h3>Select Genres</h3>
            <div className="genre-list">
              {genres.map((genre) => (
                <div
                  key={genre}
                  className={`genre-item ${selectedGenres.includes(genre) ? "selected" : ""}`}
                  onClick={() => handleGenreClick(genre)}
                >
                  {genre}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <button
              className="generate-button"
              disabled={selectedGenres.length === 0}
              onClick={handleRecommendSongs}
            >
              Recommend Songs
            </button>
          </div>
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
      )}
    </div>
  );
};

export default DetectEmotion;
