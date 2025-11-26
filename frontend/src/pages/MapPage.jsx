import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPinned, Layers, Calendar, Users } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Bangalore coordinates
const BANGALORE_CENTER = [12.9716, 77.5946];

// Category colors
const CATEGORY_STYLES = {
  happy: { color: '#FCD34D', emoji: '😊', label: 'Happy' },
  romantic: { color: '#F472B6', emoji: '💕', label: 'Romantic' },
  sad: { color: '#60A5FA', emoji: '😢', label: 'Sad' },
  nostalgic: { color: '#818CF8', emoji: '💙', label: 'Nostalgic' },
  funny: { color: '#34D399', emoji: '😂', label: 'Funny' },
  general: { color: '#9CA3AF', emoji: '📍', label: 'General' }
};

// Create custom marker icon
const createCustomIcon = (color, emoji) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        ${emoji}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createZoneIcon = () => {
  return L.divIcon({
    className: 'zone-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 4px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        animation: pulse 2s infinite;
      ">
        🌟
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Component to handle map events
function MapEvents({ onMapClick }) {
  const map = useMap();
  
  useEffect(() => {
    map.on('click', (e) => {
      onMapClick(e.latlng);
    });
    
    return () => {
      map.off('click');
    };
  }, [map, onMapClick]);
  
  return null;
}

// Component to recenter map
function RecenterMap({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

function MapPage({ token, user, onLogout }) {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneMemories, setZoneMemories] = useState([]);
  const [friendsMemories, setFriendsMemories] = useState([]);
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);
  const [userLocation, setUserLocation] = useState(BANGALORE_CENTER);
  const [droppedPin, setDroppedPin] = useState(null);
  const [mapCenter, setMapCenter] = useState(BANGALORE_CENTER);
  
  const [memoryForm, setMemoryForm] = useState({
    content_text: '',
    memory_type: 'text',
    category: 'general',
    file: null,
    visibility: 'public',
    duration: '7' // '2' for 48hrs, '7' for 7 days, '0' for permanent
  });
  const [detectingMood, setDetectingMood] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);

  useEffect(() => {
    fetchMemories();
    fetchZones();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = [position.coords.latitude, position.coords.longitude];
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

  const fetchZones = async () => {
    try {
      const response = await axios.get(`${API}/zones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setZones(response.data);
    } catch (error) {
      console.error('Failed to load zones:', error);
    }
  };

  const generateZones = async () => {
    try {
      toast.info('Generating zones...');
      const response = await axios.post(`${API}/zones/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      fetchZones();
    } catch (error) {
      toast.error('Failed to generate zones');
    }
  };

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

  const handleMapClick = (latlng) => {
    const clickedLocation = latlng;
    
    if (!userLocation) {
      toast.error('Unable to determine your location. Please enable location access.');
      return;
    }
    
    const distance = calculateDistance(
      userLocation[0],
      userLocation[1],
      clickedLocation.lat,
      clickedLocation.lng
    );
    
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
      formData.append('visibility', memoryForm.visibility);
      
      // Handle duration based on visibility
      if (memoryForm.visibility === 'public') {
        formData.append('custom_duration_days', memoryForm.duration);
      } else {
        // Friends: always permanent
        formData.append('custom_duration_days', '0');
      }
      
      // Handle file upload (photo or voice)
      if (memoryForm.file) {
        formData.append('file', memoryForm.file);
      } else if (audioBlob) {
        // Voice recording
        const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
        formData.append('file', audioFile);
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
      setAudioBlob(null);
      setMemoryForm({ content_text: '', memory_type: 'text', category: 'general', file: null, visibility: 'public', duration: '7' });
      fetchMemories();
      
      // Check if we should regenerate zones
      setTimeout(() => generateZones(), 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create memory');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMemoryForm({ ...memoryForm, file: file });
      
      // Determine memory type based on file
      if (file.type.startsWith('audio/')) {
        setMemoryForm({ ...memoryForm, file: file, memory_type: 'voice' });
      } else if (file.type.startsWith('image/')) {
        setMemoryForm({ ...memoryForm, file: file, memory_type: 'photo' });
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        setMemoryForm({ ...memoryForm, memory_type: 'voice' });
        toast.success('Voice note recorded!');
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.info('Recording started...');
    } catch (error) {
      toast.error('Failed to access microphone');
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const deleteVoiceNote = () => {
    setAudioBlob(null);
    setMemoryForm({ ...memoryForm, memory_type: 'text' });
    toast.info('Voice note deleted');
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
    setAudioBlob(null);
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
    setMemoryForm({ content_text: '', memory_type: 'text', category: 'general', file: null, visibility: 'public', duration: '7' });
  };

  const handleZoneClick = async (zone) => {
    try {
      const response = await axios.get(`${API}/zones/${zone.id}/memories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedZone(zone);
      setZoneMemories(response.data.all_memories || []);
      setFriendsMemories(response.data.friends_memories || []);
      setShowZoneDialog(true);
    } catch (error) {
      toast.error('Failed to load zone memories');
    }
  };

  const displayedZoneMemories = showFriendsOnly ? friendsMemories : zoneMemories;

  // Get zone color based on dominant mood
  const getZoneColor = (zone) => {
    // Determine dominant mood from zone memories
    const zoneMems = zoneMemories.filter(m => zone.memory_ids.includes(m.id));
    if (zoneMems.length === 0) return '#9333ea'; // Default purple
    
    const moodCounts = {};
    zoneMems.forEach(mem => {
      const mood = mem.category || 'general';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    const dominantMood = Object.keys(moodCounts).reduce((a, b) => 
      moodCounts[a] > moodCounts[b] ? a : b
    );
    
    return CATEGORY_STYLES[dominantMood]?.color || '#9333ea';
  };

  // Check if memory is inside any zone
  const isMemoryInZone = (memory) => {
    return zones.some(zone => {
      const distance = calculateDistance(
        memory.latitude,
        memory.longitude,
        zone.center_latitude,
        zone.center_longitude
      );
      return distance <= zone.radius_km;
    });
  };

  // Filter memories to exclude those in zones
  const memoriesOutsideZones = memories.filter(memory => !isMemoryInZone(memory));

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col bg-slate-900">
      {/* Instruction Banner */}
      <div className="bg-emerald-900/30 border-b border-emerald-800/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-300">
            <MapPinned className="w-4 h-4" />
            <p className="text-sm font-medium">Click anywhere on the map to drop a pin and create a memory</p>
          </div>
          <Button 
            onClick={generateZones}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Layers className="w-4 h-4 mr-2" />
            Generate Zones
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!loading && (
          <MapContainer 
            center={mapCenter} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapEvents onMapClick={handleMapClick} />
            <RecenterMap center={mapCenter} />

            {/* User's current location */}
            <Marker 
              position={userLocation}
              icon={createCustomIcon('#10b981', '👤')}
            >
              <Popup>Your Location</Popup>
            </Marker>

            {/* Dropped pin (temporary) */}
            {droppedPin && (
              <Marker 
                position={[droppedPin.lat, droppedPin.lng]}
                icon={createCustomIcon('#ef4444', '📍')}
              >
                <Popup>New Memory Location</Popup>
              </Marker>
            )}

            {/* Zones - Multiple circles for fade effect */}
            {zones.map((zone) => {
              const zoneColor = getZoneColor(zone);
              return (
                <div key={zone.id}>
                  {/* Outer fading circles for gradient effect */}
                  <Circle
                    center={[zone.center_latitude, zone.center_longitude]}
                    radius={zone.radius_km * 1000}
                    pathOptions={{
                      fillColor: zoneColor,
                      fillOpacity: 0.05,
                      color: zoneColor,
                      weight: 0,
                    }}
                  />
                  <Circle
                    center={[zone.center_latitude, zone.center_longitude]}
                    radius={zone.radius_km * 1000 * 0.7}
                    pathOptions={{
                      fillColor: zoneColor,
                      fillOpacity: 0.1,
                      color: zoneColor,
                      weight: 0,
                    }}
                  />
                  <Circle
                    center={[zone.center_latitude, zone.center_longitude]}
                    radius={zone.radius_km * 1000 * 0.4}
                    pathOptions={{
                      fillColor: zoneColor,
                      fillOpacity: 0.15,
                      color: zoneColor,
                      weight: 0,
                    }}
                    eventHandlers={{
                      click: () => handleZoneClick(zone)
                    }}
                  />
                  
                  {/* Zone center marker */}
                  <Marker
                    position={[zone.center_latitude, zone.center_longitude]}
                    icon={createZoneIcon()}
                    eventHandlers={{
                      click: () => handleZoneClick(zone)
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-bold text-lg">{zone.name}</h3>
                        <p className="text-sm text-gray-600">{zone.description}</p>
                        <p className="text-xs text-gray-500 mt-2">{zone.memory_count} memories</p>
                      </div>
                    </Popup>
                  </Marker>
                </div>
              );
            })}

            {/* Existing memories - Only show those outside zones */}
            {memoriesOutsideZones.map((memory) => {
              const style = CATEGORY_STYLES[memory.category] || CATEGORY_STYLES.general;
              return (
                <Marker
                  key={memory.id}
                  position={[memory.latitude, memory.longitude]}
                  icon={createCustomIcon(style.color, style.emoji)}
                >
                  <Popup>
                    <div className="p-2 max-w-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{style.emoji}</span>
                        <span className="font-semibold">{memory.username}</span>
                      </div>
                      {memory.content_text && (
                        <p className="text-sm text-gray-700 mb-2">{memory.content_text}</p>
                      )}
                      {memory.media_url && (
                        <img 
                          src={`${BACKEND_URL}${memory.media_url}`} 
                          alt="Memory" 
                          className="w-full h-32 object-cover rounded mt-2"
                        />
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(memory.created_at).toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
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
      <div className="absolute bottom-4 left-4 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-3 z-[1000]">
        <p className="text-xs font-semibold mb-2 text-gray-200">Memory Types</p>
        <div className="space-y-1">
          {Object.entries(CATEGORY_STYLES).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div style={{ backgroundColor: value.color, width: '12px', height: '12px', borderRadius: '50%' }}></div>
              <span className="text-xs text-gray-300">{value.emoji} {value.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', width: '12px', height: '12px', borderRadius: '50%' }}></div>
            <span className="text-xs text-gray-300">🌟 Zone</span>
          </div>
        </div>
      </div>

      {/* Create Memory Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && handleCancelPin()}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Create New Memory</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMemory} className="space-y-4">
            <div>
              <Label htmlFor="content" className="text-gray-300">Memory Text</Label>
              <Textarea
                id="content"
                placeholder="What happened here?"
                value={memoryForm.content_text}
                onChange={(e) => setMemoryForm({ ...memoryForm, content_text: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="mood" className="text-gray-300">Mood Category</Label>
              <div className="flex gap-2 mt-1">
                <Select 
                  value={memoryForm.category} 
                  onValueChange={(value) => setMemoryForm({ ...memoryForm, category: value })}
                >
                  <SelectTrigger className="flex-1 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(CATEGORY_STYLES).map(([key, value]) => (
                      <SelectItem key={key} value={key} className="text-white hover:bg-slate-700">
                        {value.emoji} {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleDetectMood}
                  disabled={detectingMood || !memoryForm.content_text.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
                >
                  {detectingMood ? '⏳ Detecting...' : '✨ Detect Mood'}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="file" className="text-gray-300">Add Photo or Audio</Label>
              <Input
                id="file"
                type="file"
                accept="image/*,audio/*"
                onChange={handleFileChange}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
              {memoryForm.file && (
                <p className="text-xs text-emerald-400 mt-1">✓ {memoryForm.file.name}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-300">Or Record Voice Note</Label>
              <div className="flex gap-2 mt-1">
                {!audioBlob ? (
                  <Button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={isRecording ? 'bg-red-600 hover:bg-red-700 flex-1' : 'bg-blue-600 hover:bg-blue-700 flex-1'}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '🎤 Record Voice'}
                  </Button>
                ) : (
                  <div className="flex gap-2 flex-1">
                    <Button
                      type="button"
                      onClick={deleteVoiceNote}
                      variant="outline"
                      className="flex-1 border-slate-600 text-red-400 hover:bg-slate-700"
                    >
                      🗑️ Delete
                    </Button>
                    <p className="text-xs text-emerald-400 flex items-center">✓ Voice note recorded</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="visibility" className="text-gray-300">Visibility</Label>
              <Select 
                value={memoryForm.visibility} 
                onValueChange={(value) => setMemoryForm({ ...memoryForm, visibility: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="public" className="text-white hover:bg-slate-700">
                    🌍 Public
                  </SelectItem>
                  <SelectItem value="friends" className="text-white hover:bg-slate-700">
                    👥 Friends (Permanent)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {memoryForm.visibility === 'public' && (
              <div>
                <Label htmlFor="duration" className="text-gray-300">Duration</Label>
                <Select 
                  value={memoryForm.duration} 
                  onValueChange={(value) => setMemoryForm({ ...memoryForm, duration: value })}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="2" className="text-white hover:bg-slate-700">
                      ⏱️ 48 Hours
                    </SelectItem>
                    <SelectItem value="7" className="text-white hover:bg-slate-700">
                      📅 7 Days
                    </SelectItem>
                    <SelectItem value="0" className="text-white hover:bg-slate-700">
                      ♾️ Permanent
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                Create Memory
              </Button>
              <Button type="button" onClick={handleCancelPin} variant="outline" className="flex-1 border-slate-600 text-gray-300 hover:bg-slate-700">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Zone Details Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-slate-800 border-slate-700 text-white overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-purple-400 text-xl flex items-center gap-2">
              🌟 {selectedZone?.name}
            </DialogTitle>
            <p className="text-gray-400 text-sm">{selectedZone?.description}</p>
            <p className="text-gray-500 text-xs">{selectedZone?.memory_count} memories in this zone</p>
          </DialogHeader>
          
          <div className="flex gap-2 mb-3">
            <Button
              onClick={() => setShowFriendsOnly(false)}
              size="sm"
              className={showFriendsOnly ? 'bg-slate-700 hover:bg-slate-600' : 'bg-purple-600 hover:bg-purple-700'}
            >
              <Calendar className="w-4 h-4 mr-1" />
              All ({zoneMemories.length})
            </Button>
            <Button
              onClick={() => setShowFriendsOnly(true)}
              size="sm"
              className={showFriendsOnly ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-700 hover:bg-slate-600'}
            >
              <Users className="w-4 h-4 mr-1" />
              Friends ({friendsMemories.length})
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {displayedZoneMemories.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No memories to display</p>
            ) : (
              displayedZoneMemories.map((memory) => {
                const style = CATEGORY_STYLES[memory.category] || CATEGORY_STYLES.general;
                return (
                  <div key={memory.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{style.emoji}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-emerald-400">{memory.username}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {memory.content_text && (
                          <p className="text-sm text-gray-300 mb-2">{memory.content_text}</p>
                        )}
                        {memory.media_url && (
                          <img 
                            src={`${BACKEND_URL}${memory.media_url}`} 
                            alt="Memory" 
                            className="w-full h-48 object-cover rounded"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

export default MapPage;
