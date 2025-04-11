import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config/env";
import "./Home.css";
import Aurora from "./ui/Aurora/Aurora";

const Home: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
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

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleNavigation = async (endpoint: string) => {
    try {
      setMenuOpen(false); // Close menu after navigation
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
      <Aurora />
      <nav className="navbar">
        <div className="navbar-left">
          <h1>Aura</h1>
        </div>
        <div className="navbar-right">
          <div className="desktop-menu">
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
          <div className="mobile-menu-icon" onClick={toggleMenu}>
            <div className={`hamburger ${menuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${menuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-close" onClick={toggleMenu}>×</div>
        <div className="mobile-menu-content">
          <div className="menu-item" onClick={() => handleNavigation("go/profile")}>
            Profile
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => handleNavigation("go/library")}>
            Library
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => handleNavigation("go/about")}>
            About
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => handleNavigation("spotify/logout")}>
            Logout
          </div>
        </div>
      </div>

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

export default Home;
