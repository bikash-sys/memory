import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Users, Navigation, Image, FileText, Mic } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Category colors
const CATEGORY_STYLES = {
  happy: { color: '#FCD34D', emoji: '😊', label: 'Happy' },
  romantic: { color: '#F472B6', emoji: '💕', label: 'Romantic' },
  sad: { color: '#60A5FA', emoji: '😢', label: 'Sad' },
  nostalgic: { color: '#818CF8', emoji: '💙', label: 'Nostalgic' },
  funny: { color: '#34D399', emoji: '😂', label: 'Funny' },
  general: { color: '#9CA3AF', emoji: '📍', label: 'General' }
};

function NearbyPage({ token }) {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(5); // Default 5km

  useEffect(() => {
    getUserLocationAndFetch();
  }, [radius]);

  const getUserLocationAndFetch = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          fetchNearbyMemories(location.lat, location.lng);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Please enable location access to see nearby memories');
          setLoading(false);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
      setLoading(false);
    }
  };

  const fetchNearbyMemories = async (lat, lng) => {
    try {
      const response = await axios.get(`${API}/memories/nearby/friends`, {
        params: { lat, lng, radius },
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemories(response.data);
    } catch (error) {
      toast.error('Failed to load nearby memories');
    } finally {
      setLoading(false);
    }
  };

  const getMemoryIcon = (type) => {
    switch (type) {
      case 'photo': return <Image className="w-4 h-4" />;
      case 'voice': return <Mic className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Navigation className="w-8 h-8 text-emerald-500" />
            Nearby Friends' Memories
          </h1>
          <p className="text-gray-400">
            Discover memories from friends within {radius}km of your location
          </p>
        </div>

        {/* Radius Selector */}
        <Card className="p-4 mb-6 bg-slate-800 border-slate-700">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-300">
              Search Radius:
            </label>
            <div className="flex gap-2">
              {[1, 3, 5, 10, 20].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  onClick={() => {
                    setRadius(r);
                    setLoading(true);
                  }}
                  className={
                    radius === r
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-gray-300"
                  }
                >
                  {r}km
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !userLocation ? (
          <Card className="p-12 text-center bg-slate-800 border-slate-700">
            <Navigation className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">Location Access Required</h3>
            <p className="text-gray-400 mb-6">
              Please enable location access to see nearby memories
            </p>
            <Button
              onClick={getUserLocationAndFetch}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Enable Location
            </Button>
          </Card>
        ) : memories.length === 0 ? (
          <Card className="p-12 text-center bg-slate-800 border-slate-700">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">No Nearby Memories</h3>
            <p className="text-gray-400 mb-6">
              No friends have shared memories within {radius}km of your location
            </p>
            <Button
              onClick={() => navigate('/profile')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Add Friends
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memories.map((memory) => (
              <Card
                key={memory.id}
                className="p-4 bg-slate-800 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer"
                onClick={() => navigate('/', { state: { focusMemory: memory } })}
                data-testid="nearby-memory-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CATEGORY_STYLES[memory.category]?.emoji}</span>
                    <div>
                      <p className="font-medium text-white text-sm">{memory.username}</p>
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        {getMemoryIcon(memory.memory_type)}
                        <span className="capitalize">{memory.memory_type}</span>
                      </div>
                    </div>
                  </div>
                  {userLocation && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                      <MapPin className="w-3 h-3" />
                      {calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        memory.latitude,
                        memory.longitude
                      )}km
                    </div>
                  )}
                </div>

                {memory.content_text && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-3">
                    {memory.content_text}
                  </p>
                )}

                {memory.media_url && memory.memory_type === 'photo' && (
                  <div className="mb-3 rounded-lg overflow-hidden">
                    <img
                      src={memory.media_url.startsWith('http') ? memory.media_url : `${BACKEND_URL}${memory.media_url}`}
                      alt="Memory"
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        console.error('Image load error:', e.target.src);
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {memory.media_url && memory.memory_type === 'voice' && (
                  <audio 
                    controls 
                    className="w-full mb-3"
                    preload="metadata"
                    onError={(e) => console.error('Audio playback error:', e)}
                  >
                    <source src={`${BACKEND_URL}${memory.media_url}`} type="audio/webm" />
                    <source src={`${BACKEND_URL}${memory.media_url}`} type="audio/ogg" />
                    <source src={`${BACKEND_URL}${memory.media_url}`} type="audio/mp4" />
                    Your browser does not support audio playback.
                  </audio>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-slate-700">
                  <span className="text-gray-500">
                    {new Date(memory.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-emerald-400">
                    {CATEGORY_STYLES[memory.category]?.label}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NearbyPage;
