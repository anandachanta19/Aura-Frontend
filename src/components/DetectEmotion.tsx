import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Webcam from "react-webcam";
import "./DetectEmotion.css";
import Aurora from "./ui/Aurora/Aurora";

const emotionGenreMapping: Record<string, string[]> = {
  Happy: ["Pop", "Dance", "Electronic", "Funk", "Disco"],
  Sad: ["Acoustic", "Blues", "Classical", "Soul", "Folk"],
  Angry: ["Metal", "Rock", "Punk", "Hardcore", "Grunge"],
  Surprise: ["Indie", "Alternative", "Experimental", "Psychedelic"],
  Excited: ["Hip-Hop", "Rap", "Party", "Trap", "Reggaeton"],
  Calm: ["Ambient", "Chill", "Jazz", "Lo-Fi", "New-Age"],
};

const emotionSentences: Record<string, string> = {
  Happy: "You seem to be in a great mood! Let's find some upbeat music for you.",
  Sad: "Feeling down? Here's some soothing music to lift your spirits.",
  Angry: "Let's channel that energy with some intense tunes.",
  Surprise: "Surprised? Let's explore some experimental genres together.",
  Excited: "You're full of energy! Let's get the party started with some lively beats.",
  Calm: "You seem relaxed. Here's some chill music to keep the vibe going.",
};

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
    calm: 0, // Changed from neutral to calm
    fearful: 0,
  });

  const genres = detectedEmotion ? emotionGenreMapping[detectedEmotion] || [] : [];

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
        const mappedKey = key === "surprise" ? "surprised" : key === "fear" ? "fearful" : key === "neutral" ? "calm" : key;
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
            emotion_count: emotionCount.current,
          }, {
            params: { session: sessionKey }, // Pass session key as a query parameter
          });
          const data = response.data;
          if ("error" in data) {
            throw new Error(data.error);
          }
          const dominantEmotion = data.dominant_emotion === "neutral" ? "calm" : data.dominant_emotion;
          const formattedEmotion = dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1); // Capitalize emotion
          setDetectedEmotion(formattedEmotion);
          setSelectedGenres([]); // Ensure no genres are pre-selected
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
      emotionCount.current = { happy: 0, angry: 0, sad: 0, surprised: 0, calm: 0, fearful: 0 };
      setIsDetecting(true);
    }
  };

  const handleGenreClick = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleRecommendSongs = async () => {
    try {
      const response = await axios.post("http://localhost:8000/api/go/recommend/songs/", {
        emotion: detectedEmotion,
        genres: selectedGenres,
      }, {
        params: { session: sessionKey },
      });
      const data = response.data;
      if (data.redirect_url) {
        window.location.href = `${data.redirect_url}&emotion=${encodeURIComponent(detectedEmotion || '')}&genres=${encodeURIComponent(selectedGenres.join(','))}`;
      } else {
        setError(data.error || "Failed to navigate.");
      }
    } catch (error) {
      console.error("Error navigating to Recommend Songs:", error);
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
    <div className="DetectEmotion">
      <Aurora />
      <div className="about-nav">
        <h2 className="library-title">Capture Face</h2>
        <h2 className="library-title" onClick={() => navigate(-1)}>
          Back
        </h2>
      </div>
      {isDetecting && (
        <div className="isDetectingContainer">
          <p>Hold on! We are analysing your face... </p>
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
        </div>
        
      )}
      {detectedEmotion && (
        <div className="result">
          <p className="emotion-result">
            {detectedEmotion in emotionSentences
              ? emotionSentences[detectedEmotion]
              : detectedEmotion
              ? `Detected Emotion: ${detectedEmotion}`
              : "No emotion detected. Please try again."}
          </p>
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
          <button
            className="generate-button"
            disabled={selectedGenres.length === 0}
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
      )}
    </div>
  );
};

export default DetectEmotion;
