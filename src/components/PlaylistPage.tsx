import axios from "axios";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./PlaylistPage.css";

interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: string;
  dateAdded: string;
}

interface Playlist {
  id: string;
  name: string;
  image_url: string;
  songs: Song[];
}

const PlaylistPage: React.FC = () => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session");
  const playlistId = searchParams.get("playlist_id")

  useEffect(() => {
    if (!sessionKey) {
      setError("Session key is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const fetchPlaylist = async () => {
      try {
        setLoading(true);
        const response = await axios.get<Playlist>(
          `http://localhost:8000/api/spotify/playlist/`,
          { params: { session: sessionKey, playlist_id: playlistId  } }
        );
        setPlaylist(response.data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching playlist:", err);
        setError(err.response?.data?.error || "Failed to fetch playlist.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [sessionKey, playlistId]);

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div>
        <p>Error: {error}</p>
        <a href="http://localhost:8000/api/spotify/login/">Log in with Spotify</a>
      </div>
    );

  return (
    <div
      className="main-content"
      style={{ backgroundImage: `url(${playlist?.image_url})` }}
    >
      <div className="blur-overlay"></div>
      <div className="playlist-page">
        <div className="header">
          <div
            className="playlist-artwork"
            style={{ backgroundImage: `url(${playlist?.image_url})` }}
          ></div>
          <div className="playlist-info">
            <div className="label">Playlist</div>
            <h1>{playlist?.name}</h1>
            <p>50 songs, 3 hr 20 min</p>
            <button className="play-button">Play</button>
          </div>
        </div>
        <div className="song-list">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Album</th>
                <th>Date Added</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {playlist?.songs.map((song, index) => (
                <tr key={song.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="song-info">
                      <img src={song.albumArt} alt={song.title} />
                      <div>
                        <div className="title">{song.title}</div>
                        <div className="artist">{song.artist}</div>
                      </div>
                    </div>
                  </td>
                  <td>{song.album}</td>
                  <td>{song.dateAdded}</td>
                  <td>{song.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlaylistPage;
