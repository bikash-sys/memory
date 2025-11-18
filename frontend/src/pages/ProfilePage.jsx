import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Users, Search, Check, X, Edit, Camera, User as UserIcon, MapPin } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ProfilePage({ token, user, onLogout }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(user);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    city: user?.city || '',
    region: user?.region || ''
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    fetchFriends();
    fetchFriendRequests();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      setProfileForm({
        username: response.data.username || '',
        city: response.data.city || '',
        region: response.data.region || ''
      });
    } catch (error) {
      console.error('Failed to fetch user profile', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await axios.get(`${API}/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriendRequests(response.data);
    } catch (error) {
      console.error('Failed to load friend requests', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await axios.get(`${API}/users/search?q=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Failed to search users');
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      await axios.post(
        `${API}/friends/request`,
        { to_user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Friend request sent!');
      setSearchResults(searchResults.filter(u => u.id !== userId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send request');
    }
  };

  const acceptFriendRequest = async (friendshipId) => {
    try {
      await axios.post(
        `${API}/friends/accept/${friendshipId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Friend request accepted!');
      fetchFriends();
      fetchFriendRequests();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const rejectFriendRequest = async (friendshipId) => {
    try {
      await axios.post(
        `${API}/friends/reject/${friendshipId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Friend request rejected');
      fetchFriendRequests();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `${API}/users/profile`,
        profileForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentUser(response.data);
      toast.success('Profile updated successfully!');
      setShowEditDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/users/profile-photo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setCurrentUser({ ...currentUser, profile_picture: response.data.profile_picture });
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 shadow-sm" data-testid="profile-header">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Friends & Profile</h1>
          
          <Button
            size="sm"
            onClick={() => setShowSearchDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 text-white"
            data-testid="add-friend-button"
          >
            <UserPlus className="w-4 h-4" />
            Add Friend
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* User Profile Card */}
        <Card className="p-6 bg-slate-800 border-slate-700" data-testid="user-profile-card">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <UserIcon className="w-5 h-5 text-emerald-500" />
              Your Profile
            </h2>
            <Button
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 gap-2 text-white"
              data-testid="edit-profile-button"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
          </div>

          <div className="flex items-center gap-6">
            {/* Profile Picture */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                {currentUser?.profile_picture ? (
                  <img 
                    src={currentUser.profile_picture.startsWith('http') ? currentUser.profile_picture : `${BACKEND_URL}${currentUser.profile_picture}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  currentUser?.username?.charAt(0).toUpperCase()
                )}
              </div>
              <label 
                htmlFor="profile-photo-upload" 
                className="absolute bottom-0 right-0 bg-emerald-600 hover:bg-emerald-700 rounded-full p-2 cursor-pointer shadow-lg"
              >
                {uploadingPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </label>
              <input
                id="profile-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white">{currentUser?.username}</h3>
              <p className="text-gray-300">{currentUser?.email}</p>
              {currentUser?.city && (
                <div className="flex items-center gap-2 mt-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{currentUser.city}{currentUser.region && `, ${currentUser.region}`}</span>
                </div>
              )}
              {!currentUser?.city && !currentUser?.region && (
                <p className="text-gray-400 text-sm mt-2">No location set</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-500">0</div>
                <div className="text-xs text-gray-400">Memories</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-500">{friends.length}</div>
                <div className="text-xs text-gray-400">Friends</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <Card className="p-6 bg-slate-800 border-slate-700" data-testid="friend-requests-section">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-emerald-500" />
              Friend Requests ({friendRequests.length})
            </h2>
            <div className="space-y-3">
              {friendRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                  data-testid="friend-request-item"
                >
                  <div>
                    <p className="font-medium text-white">{request.from_user?.username}</p>
                    <p className="text-sm text-gray-300">{request.from_user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptFriendRequest(request.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      data-testid="accept-request-button"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectFriendRequest(request.id)}
                      className="border-slate-600 hover:bg-slate-600 text-white"
                      data-testid="reject-request-button"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Friends List */}
        <Card className="p-6 bg-slate-800 border-slate-700" data-testid="friends-list-section">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-emerald-500" />
            Your Friends ({friends.length})
          </h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No friends yet. Add some friends to share memories!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-4 bg-slate-700 rounded-lg"
                  data-testid="friend-item"
                >
                  <p className="font-medium text-white">{friend.username}</p>
                  <p className="text-sm text-gray-300">{friend.email}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700" data-testid="search-friends-dialog">
          <DialogHeader>
            <DialogTitle className="text-white">Find Friends</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or email"
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                data-testid="search-input"
              />
              <Button onClick={searchUsers} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="search-button">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                  data-testid="search-result-item"
                >
                  <div>
                    <p className="font-medium text-white">{searchUser.username}</p>
                    <p className="text-sm text-gray-300">{searchUser.email}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sendFriendRequest(searchUser.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="send-request-button"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && (
                <p className="text-center text-gray-400 py-4">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700" data-testid="edit-profile-dialog">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Profile</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <Label className="text-gray-200">Username</Label>
              <Input
                value={profileForm.username}
                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                placeholder="Enter your username"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                data-testid="username-input"
              />
            </div>

            <div>
              <Label className="text-gray-200">City</Label>
              <Input
                value={profileForm.city}
                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                placeholder="Enter your city (e.g., Bangalore)"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                data-testid="city-input"
              />
            </div>

            <div>
              <Label className="text-gray-200">Region / State</Label>
              <Input
                value={profileForm.region}
                onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}
                placeholder="Enter your region (e.g., Karnataka)"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-gray-400"
                data-testid="region-input"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                data-testid="save-profile-button"
              >
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="border-slate-600 hover:bg-slate-700 text-white"
                data-testid="cancel-edit-button"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilePage;
