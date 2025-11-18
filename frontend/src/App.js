import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import "leaflet/dist/leaflet.css";
import { Toaster } from "@/components/ui/sonner";
import AuthPage from "@/pages/AuthPage";
import MapPage from "@/pages/MapPage";
import ProfilePage from "@/pages/ProfilePage";
import MyMemoriesPage from "@/pages/MyMemoriesPage";
import NearbyPage from "@/pages/NearbyPage";
import NavigationBar from "@/components/Navigation";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <div className="App dark">
      <BrowserRouter>
        {token && <NavigationBar onLogout={handleLogout} />}
        <Routes>
          <Route
            path="/auth"
            element={
              token ? <Navigate to="/" /> : <AuthPage onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              token ? (
                <MapPage token={token} user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
          <Route
            path="/my-memories"
            element={
              token ? (
                <MyMemoriesPage token={token} user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
          <Route
            path="/nearby"
            element={
              token ? (
                <NearbyPage token={token} user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
          <Route
            path="/profile"
            element={
              token ? (
                <ProfilePage token={token} user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
