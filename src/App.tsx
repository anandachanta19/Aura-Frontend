import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import About from "./components/About";
import Home from "./components/Home";
import Library from "./components/Library";
import Mediaplayer from "./components/MediaPlayer";
import OAuth from "./components/OAuthPage";
import PlaylistPage from "./components/PlaylistPage";
import Profile from "./components/Profile";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OAuth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/home" element={<Home />} />
        <Route path="/library" element={<Library />} />
        <Route path="/about" element={<About />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        <Route path="/mediaplayer" element={<Mediaplayer />} />
      </Routes>
    </Router>
  );
}

export default App;
