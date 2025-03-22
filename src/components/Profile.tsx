import axios from "axios";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Profile.css";

interface SpotifyProfile {
  display_name: string;
  email: string;
  followers: number;
  profile_picture: string | null;
  top_artists: string[];
  playlists: string[];
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
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

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await axios.get<SpotifyProfile>(
          `http://localhost:8000/api/user/profile/`,
          { params: { session: sessionKey } },
        );
        setProfile(response.data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.response?.data?.error || "Failed to fetch profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [sessionKey]);

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
    <div
      className="profile-container"
      style={{ backgroundImage: `url(${profile?.profile_picture})` }}
    >
      <div className="blur-overlay"></div>

      <div className="header">
        <h2 className="nav-title">Profile</h2>
        <button className="back-button" onClick={() => window.history.back()}>
          <h2 className="nav-title">Back</h2>
        </button>
      </div>

      <div className="profile-data-container">
        <div className="profile-content">
          <img
            src={profile?.profile_picture}
            alt="Profile"
            className="profile-pic"
          />
          <h1 className="display-name">{profile?.display_name}</h1>
          <p className="email">Email: {profile?.email}</p>
          <p className="followers">Followers: {profile?.followers}</p>
        </div>
        <div className="info-section">
          <div className="top-artists">
            <h3>TOP ARTISTS</h3>
            <ul>
              {profile?.top_artists.map((artist, index) => (
                <li key={index}>{artist}</li>
              ))}
            </ul>
          </div>
          <div className="playlists">
            <h3>PLAYLISTS</h3>
            <ul>
              {profile?.playlists.map((playlist, index) => (
                <li key={index}>{playlist}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
