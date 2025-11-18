import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Calendar, Trash2, Image, FileText, Mic } from "lucide-react";

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

function MyMemoriesPage({ token }) {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyMemories();
  }, []);

  const fetchMyMemories = async () => {
    try {
      const response = await axios.get(`${API}/memories/my/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMemories(response.data);
    } catch (error) {
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    if (!window.confirm('Are you sure you want to delete this memory?')) {
      return;
    }

    try {
      await axios.delete(`${API}/memories/${memoryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Memory deleted successfully');
      fetchMyMemories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete memory');
    }
  };

  const getMemoryIcon = (type) => {
    switch (type) {
      case 'photo': return <Image className="w-4 h-4" />;
      case 'voice': return <Mic className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Memories</h1>
          <p className="text-gray-400">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'} created
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : memories.length === 0 ? (
          <Card className="p-12 text-center bg-slate-800 border-slate-700">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">No Memories Yet</h3>
            <p className="text-gray-400 mb-6">
              Start creating memories by dropping pins on the map
            </p>
            <Button
              onClick={() => navigate('/')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Go to Map
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memories.map((memory) => (
              <Card
                key={memory.id}
                className="p-4 bg-slate-800 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer"
                data-testid="memory-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CATEGORY_STYLES[memory.category]?.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        {getMemoryIcon(memory.memory_type)}
                        <span className="capitalize">{memory.memory_type}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {CATEGORY_STYLES[memory.category]?.label}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMemory(memory.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    data-testid="delete-memory-button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {memory.content_text && (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-3">
                    {memory.content_text}
                  </p>
                )}

                {memory.media_url && (
                  <div className="mb-3 rounded-lg overflow-hidden">
                    <img
                      src={memory.media_url.startsWith('http') ? memory.media_url : `${BACKEND_URL}${memory.media_url}`}
                      alt="Memory"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(memory.created_at).toLocaleDateString()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/', { state: { focusMemory: memory } })}
                    className="text-emerald-400 hover:text-emerald-300 text-xs h-auto p-1"
                  >
                    View on Map
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyMemoriesPage;
