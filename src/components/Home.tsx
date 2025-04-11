import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config/env";
import "./Home.css";
// Import Aurora component with error handling
import Aurora from "./ui/Aurora/Aurora";

const Home: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const [auroraError, setAuroraError] = useState<boolean>(false);

  useEffect(() => {
    // Log the backend URL to debug in production
    console.log("Current BACKEND_URL:", BACKEND_URL);
    
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [sessionKey]);

  const handleNavigation = async (endpoint: string) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/${endpoint}?session=${sessionKey}`,
        {
          credentials: "include",
        },
      );
      const data = await response.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
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
        <a href={`${BACKEND_URL}/api/spotify/login/`}>
          Log in with Spotify
        </a>
      </div>
    );

  return (
    <div className="home-container">
      {!auroraError ? 
        <React.Suspense fallback={<div>Loading Aurora...</div>}>
          <ErrorBoundary onError={() => setAuroraError(true)}>
            <Aurora />
          </ErrorBoundary>
        </React.Suspense> : 
        <div className="aurora-fallback"></div>
      }
      <nav className="navbar">
        <div className="navbar-left">
          <h1>Aura</h1>
        </div>
        <div className="navbar-right">
          <button onClick={() => handleNavigation("go/profile")}>
            Profile
          </button>
          <button onClick={() => handleNavigation("go/library")}>
            Library
          </button>
          <button onClick={() => handleNavigation("go/about")}>About</button>
          <button onClick={() => handleNavigation("spotify/logout")}>
            Logout
          </button>
        </div>
      </nav>
      <div className="recommendation">
        <p>Wanna get recommendations based on your current emotion?</p>
        <h2>CHOOSE AN OPTION</h2>
        <div className="button-group">
          <button className="capture-button" onClick={() => handleNavigation("go/detect/emotion")}>Capture Face</button>
          <button className="select-button" onClick={() => handleNavigation("go/select/emotion")}>Select Emotion</button>
        </div>
        <p className="note">For better results, try Select Emotion.</p>
      </div>
    </div>
  );
};

// Error Boundary Component for handling runtime errors
class ErrorBoundary extends React.Component<{children: React.ReactNode, onError: () => void}> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error) {
    console.error("Component error:", error);
    this.props.onError();
  }
  
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default Home;
