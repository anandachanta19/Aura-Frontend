import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import About from "./components/About";
import DetectEmotion from "./components/DetectEmotion";
import EmotionSelection from "./components/EmotionSelection";
import Home from "./components/Home";
import Library from "./components/Library";
import Mediaplayer from "./components/MediaPlayer";
import OAuth from "./components/OAuthPage";
import PlaylistPage from "./components/PlaylistPage";
import Profile from "./components/Profile";
import RecommendSongs from "./components/RecommendSongs";

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
        <Route path="/select/emotion" element={<EmotionSelection />} />
        <Route path="/detect/emotion" element={<DetectEmotion />} />
        <Route path="/recommend/songs" element={<RecommendSongs />} />
      </Routes>
    </Router>
  );
}

export default App;
