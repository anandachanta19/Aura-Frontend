import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Home.css";
import Aurora from "./ui/Aurora/Aurora";

const Home: React.FC = () => {
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

  const handleNavigation = async (endpoint: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/${endpoint}?session=${sessionKey}`);
      if (response.redirected) {
        window.location.href = response.url; // Redirect to the URL provided by the backend
      } else {
        const data = await response.json();
        setError(data.error || "Failed to navigate.");
      }
    } catch (err) {
      setError("An error occurred while navigating.");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href="http://localhost:8000/api/spotify/login/">
          Log in with Spotify
        </a>
      </div>
    );

  return (
    <div className="home-container">
      <Aurora />
      <nav className="navbar">
        <div className="navbar-left">
          <h1>Aura</h1>
        </div>
        <div className="navbar-right">
          <button onClick={() => handleNavigation("go/home")}>Home</button>
          <button onClick={() => handleNavigation("go/profile")}>Profile</button>
          <a href="/library">Library</a>
          <a href="/about">About</a>
        </div>
      </nav>
      <div className="recommendation">
        <p>Wanna get recommendations based on your current emotion?</p>
        <h2>CHOOSE AN OPTION</h2>
        <div className="button-group">
          <button className="capture-button">Capture Face</button>
          <button className="select-button">Select Emotion</button>
        </div>
        <p className="note">For better results, try Select Emotion.</p>
      </div>
    </div>
  );
};

export default Home;