import { useState, useEffect } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X, MapPinned } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Bangalore coordinates
const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  // Ensure map stays in light mode
  styles: [],
  backgroundColor: '#ffffff'
};

// Category colors
const CATEGORY_STYLES = {
  happy: { color: '#FCD34D', emoji: '😊', label: 'Happy' },
  romantic: { color: '#F472B6', emoji: '💕', label: 'Romantic' },
  sad: { color: '#60A5FA', emoji: '😢', label: 'Sad' },
  nostalgic: { color: '#818CF8', emoji: '💙', label: 'Nostalgic' },
  funny: { color: '#34D399', emoji: '😂', label: 'Funny' },
  general: { color: '#9CA3AF', emoji: '📍', label: 'General' }
};

function MapPage({ token, user, onLogout }) {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [userLocation, setUserLocation] = useState(BANGALORE_CENTER);
  const [droppedPin, setDroppedPin] = useState(null);
  const [mapCenter, setMapCenter] = useState(BANGALORE_CENTER);
  
  const [memoryForm, setMemoryForm] = useState({
    content_text: '',
    memory_type: 'text',
    category: 'general',
    file: null
  });
  const [detectingMood, setDetectingMood] = useState(false);

  useEffect(() => {
    fetchMemories();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setMapCenter(location);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.info('Using default location: Bangalore');
        }
      );
    }
  };

  const fetchMemories = async () => {
    try {
      const response = await axios.get(`${API}/memories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemories(response.data);
    } catch (error) {
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two points using Haversine formula (in km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleMapClick = (e) => {
    const clickedLocation = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    
    // Check if user location is available
    if (!userLocation) {
      toast.error('Unable to determine your location. Please enable location access.');
      return;
    }
    
    // Calculate distance from user's current location
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      clickedLocation.lat,
      clickedLocation.lng
    );
    
    // Check if within 2km range
    if (distance > 2) {
      toast.error(`You can only create memories within 2km of your location. This location is ${distance.toFixed(1)}km away.`);
      return;
    }
    
    setDroppedPin(clickedLocation);
    setShowCreateDialog(true);
  };

  const handleCreateMemory = async (e) => {
    e.preventDefault();
    
    if (!droppedPin) {
      toast.error('Please drop a pin on the map first');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('latitude', droppedPin.lat);
      formData.append('longitude', droppedPin.lng);
      formData.append('content_text', memoryForm.content_text);
      formData.append('memory_type', memoryForm.memory_type);
      formData.append('category', memoryForm.category);
      
      if (memoryForm.file) {
        formData.append('file', memoryForm.file);
      }

      await axios.post(`${API}/memories/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Memory created successfully!');
      setShowCreateDialog(false);
      setDroppedPin(null);
      setMemoryForm({ content_text: '', memory_type: 'text', category: 'general', file: null });
      fetchMemories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create memory');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setMemoryForm({ ...memoryForm, file: e.target.files[0] });
    }
  };

  const handleDetectMood = async () => {
    if (!memoryForm.content_text.trim()) {
      toast.error('Please write your memory text first');
      return;
    }

    setDetectingMood(true);
    try {
      const response = await axios.post(
        `${API}/detect-mood`,
        { text: memoryForm.content_text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const detectedMood = response.data.mood;
      setMemoryForm({ ...memoryForm, category: detectedMood });
      toast.success(`Mood detected: ${CATEGORY_STYLES[detectedMood]?.label || detectedMood} ${CATEGORY_STYLES[detectedMood]?.emoji || ''}`);
    } catch (error) {
      toast.error('Failed to detect mood. Please try again.');
      console.error('Mood detection error:', error);
    } finally {
      setDetectingMood(false);
    }
  };

  const handleCancelPin = () => {
    setDroppedPin(null);
    setShowCreateDialog(false);
    setMemoryForm({ content_text: '', memory_type: 'text', category: 'general', file: null });
  };

  // Create custom marker icon
  const getMarkerIcon = (category) => {
    const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
    return {
      path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
      fillColor: style.color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
      scale: 12,
    };
  };

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col bg-slate-900">
      {/* Instruction Banner */}
      <div className="bg-emerald-900/30 border-b border-emerald-800/50 px-4 py-2" data-testid="instruction-banner">
        <div className="flex items-center justify-center gap-2 text-emerald-300">
          <MapPinned className="w-4 h-4" />
          <p className="text-sm font-medium">Click anywhere on the map to drop a pin and create a memory</p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative" data-testid="map-container">
        {!loading && GOOGLE_MAPS_API_KEY && (
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={13}
              options={mapOptions}
              onClick={handleMapClick}
            >
              {/* User's current location */}
              <Marker
                position={userLocation}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  fillColor: '#10b981',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                  scale: 8,
                }}
                title="Your Location"
              />

              {/* Dropped pin (temporary) */}
              {droppedPin && (
                <Marker
                  position={droppedPin}
                  animation={window.google?.maps?.Animation?.BOUNCE}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                    scale: 15,
                  }}
                />
              )}

              {/* Existing memories */}
              {memories.map((memory) => (
                <Marker
                  key={memory.id}
                  position={{ lat: memory.latitude, lng: memory.longitude }}
                  icon={getMarkerIcon(memory.category)}
                  onClick={() => setSelectedMemory(memory)}
                />
              ))}

              {/* Info Window for selected memory */}
              {selectedMemory && (
                <InfoWindow
                  position={{ lat: selectedMemory.latitude, lng: selectedMemory.longitude }}
                  onCloseClick={() => setSelectedMemory(null)}
                >
                  <div className="p-2 max-w-xs" data-testid="memory-info-window">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{CATEGORY_STYLES[selectedMemory.category]?.emoji}</span>
                      <span className="font-semibold text-gray-900">{selectedMemory.username}</span>
                    </div>
                    {selectedMemory.content_text && (
                      <p className="text-sm text-gray-700 mb-2">{selectedMemory.content_text}</p>
                    )}
                    {selectedMemory.media_url && (
                      <img 
                        src={`${BACKEND_URL}${selectedMemory.media_url}`} 
                        alt="Memory" 
                        className="w-full h-32 object-cover rounded mt-2"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(selectedMemory.created_at).toLocaleString()}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        )}
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300">Loading memories...</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-3 z-[100]" data-testid="legend">
        <p className="text-xs font-semibold mb-2 text-gray-200">Memory Types</p>
        <div className="space-y-1">
          {Object.entries(CATEGORY_STYLES).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div style={{ backgroundColor: value.color, width: '12px', height: '12px', borderRadius: '50%' }}></div>
              <span className="text-xs text-gray-300">{value.emoji} {value.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Memory Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && handleCancelPin()}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white" data-testid="create-memory-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <MapPinned className="w-5 h-5 text-emerald-500" />
              Create Memory at This Location
            </DialogTitle>
          </DialogHeader>
          
          {droppedPin && (
            <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-lg p-3 mb-3">
              <p className="text-xs text-emerald-300">
                <strong>Location:</strong> {droppedPin.lat.toFixed(4)}, {droppedPin.lng.toFixed(4)}
              </p>
            </div>
          )}
          
          <form onSubmit={handleCreateMemory} className="space-y-4">
            <div>
              <Label className="text-gray-200">Memory Type</Label>
              <Select
                value={memoryForm.memory_type}
                onValueChange={(value) => setMemoryForm({ ...memoryForm, memory_type: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="memory-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="text">📝 Text</SelectItem>
                  <SelectItem value="photo">📷 Photo</SelectItem>
                  <SelectItem value="voice">🎤 Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-200">Mood</Label>
              <Select
                value={memoryForm.category}
                onValueChange={(value) => setMemoryForm({ ...memoryForm, category: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="general">📍 General</SelectItem>
                  <SelectItem value="happy">😊 Happy</SelectItem>
                  <SelectItem value="romantic">💕 Romantic</SelectItem>
                  <SelectItem value="sad">😢 Sad</SelectItem>
                  <SelectItem value="nostalgic">💙 Nostalgic</SelectItem>
                  <SelectItem value="funny">😂 Funny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-200">Your Memory</Label>
              <Textarea
                value={memoryForm.content_text}
                onChange={(e) => setMemoryForm({ ...memoryForm, content_text: e.target.value })}
                placeholder="Share your story about this place..."
                rows={4}
                required
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                data-testid="memory-text-input"
              />
            </div>

            <div>
              <Button
                type="button"
                onClick={handleDetectMood}
                disabled={detectingMood || !memoryForm.content_text.trim()}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                data-testid="detect-mood-button"
              >
                {detectingMood ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Detecting Mood...
                  </>
                ) : (
                  '✨ Detect Mood'
                )}
              </Button>
            </div>

            {(memoryForm.memory_type === 'photo' || memoryForm.memory_type === 'voice') && (
              <div>
                <Label className="text-gray-200">Upload File</Label>
                <Input
                  type="file"
                  accept={memoryForm.memory_type === 'photo' ? 'image/*' : 'audio/*'}
                  onChange={handleFileChange}
                  className="bg-slate-700 border-slate-600 text-white file:text-white"
                  data-testid="file-upload-input"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                data-testid="submit-memory-button"
              >
                Create Memory
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelPin}
                className="border-slate-600 hover:bg-slate-700 text-white"
                data-testid="cancel-memory-button"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MapPage;
