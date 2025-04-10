import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config/env";
import "./OAuthPage.css";
import { WavyBackground } from "./ui/wavy-background";

const OAuthPage = () => {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/hello/`)
      .then((res) => res.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    console.log(message); // This ensures we log the updated message
  }, [message]);

  const handleSpotifyLogin = () => {
    // Redirect directly to the backend login endpoint
    window.location.href = `${BACKEND_URL}/api/spotify/login/`;
  };
  return (
    <WavyBackground className="relative w-full h-screen flex items-center justify-center">
      <div className="aura-page">
        <div className="text-container">
          <p className="welcome-text">Welcome to</p>
          <h1 className="aura-title">AURA</h1>
          <p className="aura-subtitle">Levitate the aura within you.</p>
        </div>
        <button className="spotify-button" onClick={handleSpotifyLogin}>
          Connect with Spotify
        </button>
      </div>
    </WavyBackground>
  );
};

export default OAuthPage;
