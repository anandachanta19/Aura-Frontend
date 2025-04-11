import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config/env";
import "./About.css";
import Aurora from "./ui/Aurora/Aurora";

const About: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [sessionKey]);

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
    <div className="about-page">
      <Aurora />
      
      <div className="about-container">
        <div className="about-nav">
          <h2 className="library-title">About</h2>
          <h2 className="library-title" onClick={() => navigate(-1)}>
            Back
          </h2>
        </div>

        <div className="about-content">
          <h2>Emotion Based Music Player</h2>
          <p>
            The Emotion Based Music Player is a project designed to blend the
            power of music with the spectrum of human emotions. By analyzing your
            mood, the player curates tracks that resonate with your current
            feelings—creating a personalized and immersive audio experience.
          </p>
          <p>
            Using modern technologies like React for the UI and django for server
            logic, the player not only sounds good but also looks stunning. The
            dynamic aurora background enhances the visual appeal and reflects the
            ever-changing nature of emotion.
          </p>
          <p>
            Explore the project, enjoy the seamless fusion of art and technology,
            and let the music speak to your emotions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
