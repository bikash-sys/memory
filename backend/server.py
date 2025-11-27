from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Create upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app without a prefix
app = FastAPI()

# Add CORS middleware FIRST (before any routes or mounts)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mount static files for serving uploads under /api/uploads
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ===== MODELS =====

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    profile_picture: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    privacy_settings: dict = Field(default_factory=lambda: {"public_profile": True})

class Memory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    user_profile_picture: Optional[str] = None
    latitude: float
    longitude: float
    content_text: Optional[str] = None
    media_url: Optional[str] = None
    memory_type: str  # photo, text, voice
    category: str  # happy, romantic, sad, general
    season: Optional[str] = None  # summer, winter, spring, autumn
    visibility: str = "public"  # public, friends, specific_friends, private
    visible_to_users: List[str] = Field(default_factory=list)  # For specific_friends
    custom_duration_days: Optional[int] = 7  # Default 1 week for public
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    public_until: Optional[str] = None
    deletion_allowed_until: str = Field(default_factory=lambda: (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat())

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    center_latitude: float
    center_longitude: float
    radius_km: float = 0.5  # Default 500m radius
    memory_count: int = 0
    memory_ids: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MemoryCreate(BaseModel):
    latitude: float
    longitude: float
    content_text: Optional[str] = None
    memory_type: str
    category: Optional[str] = "general"
    visibility: Optional[str] = "public"
    visible_to_users: Optional[List[str]] = []
    custom_duration_days: Optional[int] = 7

class FriendRequest(BaseModel):
    to_user_id: str

class Friendship(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id_1: str
    user_id_2: str
    status: str  # pending, accepted, rejected
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    accepted_at: Optional[str] = None

class Region(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    center_lat: float
    center_lng: float
    radius: float  # in km
    dominant_mood: str
    memory_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ===== HELPER FUNCTIONS =====

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

async def detect_mood_from_text(text: str) -> str:
    """Use Gemini AI via Emergent integrations to detect mood from text"""
    try:
        # Get API key from environment - prioritize Emergent LLM key
        api_key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        
        if not api_key:
            logging.warning("No API key found, defaulting to 'general' mood")
            return "general"
        
        # Initialize LlmChat with Gemini model
        chat = LlmChat(
            api_key=api_key,
            session_id=f"mood-detection-{uuid.uuid4()}",
            system_message="You are a mood detection assistant. Analyze text and respond with ONLY one word from these categories: happy, romantic, sad, nostalgic, funny, general."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create user message with mood detection prompt
        user_message = UserMessage(
            text=f"""Analyze the following text and respond with ONLY one word from these mood categories:
- happy: joyful, excited, cheerful content
- romantic: loving, affectionate, tender moments
- sad: melancholic, sorrowful, grief
- nostalgic: remembering past, sentimental, reminiscing
- funny: humorous, amusing, comical
- general: neutral or mixed emotions

Text: {text}

Respond with ONLY the mood category word, nothing else."""
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Extract mood from response
        mood = response.lower().strip()
        valid_moods = ["happy", "romantic", "sad", "nostalgic", "funny", "general"]
        if mood not in valid_moods:
            return "general"
        return mood
    except Exception as e:
        logging.error(f"Mood detection error: {e}")
        return "general"

async def generate_region_name(location_name: str, mood: str, memory_count: int) -> str:
    """Generate creative region name based on location and mood"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('GOOGLE_API_KEY')
        
        if not api_key:
            return f"{mood.title()} Zone"
        
        mood_themes = {
            "happy": "joy, happiness, celebration, fun",
            "romantic": "love, romance, affection, warmth",
            "sad": "melancholy, reflection, contemplation, sorrow",
            "nostalgic": "memories, reminiscence, looking back, sentimental",
            "funny": "humor, laughter, amusement, comedy",
            "general": "everyday life, casual moments, general activities"
        }
        
        # Initialize LlmChat with Gemini model
        chat = LlmChat(
            api_key=api_key,
            session_id=f"region-naming-{uuid.uuid4()}",
            system_message="You are a creative naming assistant. Generate short, poetic zone names."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create user message
        user_message = UserMessage(
            text=f"""Generate a creative, short (2-4 words) name for a neighborhood zone in Bangalore.
Location area: {location_name}
Dominant mood: {mood} ({mood_themes.get(mood, '')})
Number of memories: {memory_count}

Generate a poetic, memorable name that captures the {mood} essence of this area.
Respond with ONLY the zone name, nothing else.

Examples:
- "Joyful Junction of Koramangala"
- "Romantic Corner near MG Road"
- "Reflective Realm of Indiranagar"
- "Happy Hub of Jayanagar"
"""
        )
        
        response = await chat.send_message(user_message)
        zone_name = response.strip().strip('"\'')
        return zone_name if len(zone_name) < 50 else f"{mood.title()} Zone of {location_name}"
    except Exception as e:
        logging.error(f"Region naming error: {e}")
        return f"{mood.title()} Zone"

import math

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula (in km)"""
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def cluster_memories_by_location(memories: List[dict], radius_km: float = 2.0) -> List[dict]:
    """Simple clustering of memories by geographic proximity"""
    if not memories:
        return []
    
    clusters = []
    used_memory_ids = set()
    
    for memory in memories:
        if memory['id'] in used_memory_ids:
            continue
        
        # Create new cluster
        cluster = {
            'memories': [memory],
            'center_lat': memory['latitude'],
            'center_lng': memory['longitude'],
            'mood_counts': {memory['category']: 1}
        }
        used_memory_ids.add(memory['id'])
        
        # Find nearby memories within radius_km
        for other_memory in memories:
            if other_memory['id'] in used_memory_ids:
                continue
            
            # Calculate exact distance using Haversine
            distance_km = haversine_distance(
                memory['latitude'], 
                memory['longitude'],
                other_memory['latitude'], 
                other_memory['longitude']
            )
            
            if distance_km <= radius_km:
                cluster['memories'].append(other_memory)
                cluster['mood_counts'][other_memory['category']] = cluster['mood_counts'].get(other_memory['category'], 0) + 1
                used_memory_ids.add(other_memory['id'])
        
        # Calculate cluster center (average) and only create zones with 5+ memories
        if len(cluster['memories']) >= 5:
            cluster['center_lat'] = sum(m['latitude'] for m in cluster['memories']) / len(cluster['memories'])
            cluster['center_lng'] = sum(m['longitude'] for m in cluster['memories']) / len(cluster['memories'])
            cluster['dominant_mood'] = max(cluster['mood_counts'], key=cluster['mood_counts'].get)
            clusters.append(cluster)
    
    return clusters

async def generate_zone_name_and_description(memories: List[dict], center_lat: float, center_lng: float) -> tuple:
    """Generate AI-powered zone name and description based on memories"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        if not api_key:
            return "Memory Zone", "A collection of memories"
        
        # Prepare memory summaries
        memory_texts = []
        mood_counts = {}
        for mem in memories[:10]:  # Use first 10 memories
            if mem.get('content_text'):
                memory_texts.append(mem['content_text'][:100])  # First 100 chars
            mood = mem.get('category', 'general')
            mood_counts[mood] = mood_counts.get(mood, 0) + 1
        
        dominant_mood = max(mood_counts, key=mood_counts.get) if mood_counts else 'general'
        memory_count = len(memories)
        
        # Initialize LlmChat with Gemini model
        chat = LlmChat(
            api_key=api_key,
            session_id=f"zone-naming-{uuid.uuid4()}",
            system_message="You are a creative naming assistant. Generate poetic zone names and descriptions."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create user message
        memory_preview = "\n".join([f"- {text}" for text in memory_texts[:5]])
        
        user_message = UserMessage(
            text=f"""Generate a creative name and description for a memory zone.

Memory Count: {memory_count}
Dominant Mood: {dominant_mood}
Location: Latitude {center_lat:.4f}, Longitude {center_lng:.4f}

Sample Memory Texts:
{memory_preview}

Generate:
1. A creative, poetic zone name (2-5 words)
2. A one-line description (max 15 words) capturing the essence

Format your response EXACTLY as:
NAME: [zone name]
DESCRIPTION: [one-line description]

Examples:
NAME: Joyful Crossroads
DESCRIPTION: Where laughter echoes and happy moments converge in celebration.

NAME: Nostalgic Haven
DESCRIPTION: A place of cherished memories and wistful reflections.
"""
        )
        
        response = await chat.send_message(user_message)
        
        # Parse response
        lines = response.strip().split('\n')
        zone_name = "Memory Zone"
        zone_description = "A collection of shared memories"
        
        for line in lines:
            if line.startswith('NAME:'):
                zone_name = line.replace('NAME:', '').strip().strip('"\'')
            elif line.startswith('DESCRIPTION:'):
                zone_description = line.replace('DESCRIPTION:', '').strip().strip('"\'')
        
        # Fallback if parsing failed
        if zone_name == "Memory Zone" and len(lines) >= 2:
            zone_name = lines[0].replace('NAME:', '').strip().strip('"\'')
            zone_description = lines[1].replace('DESCRIPTION:', '').strip().strip('"\'')
        
        return zone_name, zone_description
    except Exception as e:
        logging.error(f"Zone naming error: {e}")
        return f"{dominant_mood.title()} Memory Zone", f"A collection of {memory_count} memories"


# ===== AUTH ROUTES =====

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if email exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        phone=user_data.phone
    )
    
    user_dict = user.model_dump()
    user_dict["password_hash"] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({"user_id": user.id, "email": user.email})
    
    return {
        "token": token,
        "user": {"id": user.id, "username": user.username, "email": user.email}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"user_id": user["id"], "email": user["email"]})
    
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

class MoodDetectRequest(BaseModel):
    text: str

@api_router.post("/detect-mood")
async def detect_mood_endpoint(request: MoodDetectRequest, user_id: str = Depends(get_current_user)):
    """Endpoint to detect mood from text using Gemini AI"""
    mood = await detect_mood_from_text(request.text)
    return {"mood": mood}

class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None

@api_router.put("/users/profile")
async def update_profile(
    profile_data: ProfileUpdateRequest,
    user_id: str = Depends(get_current_user)
):
    """Update user profile information"""
    update_data = {}
    
    if profile_data.username:
        # Check if username is already taken by another user
        existing = await db.users.find_one({
            "username": profile_data.username,
            "id": {"$ne": user_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = profile_data.username
    
    if profile_data.city is not None:
        update_data["city"] = profile_data.city
    
    if profile_data.region is not None:
        update_data["region"] = profile_data.region
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Return updated user
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@api_router.post("/users/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    """Upload user profile photo"""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save file
        file_extension = file.filename.split(".")[-1]
        file_name = f"profile_{user_id}.{file_extension}"
        file_path = UPLOAD_DIR / file_name
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        profile_picture_url = f"/api/uploads/{file_name}"
        
        # Update user profile
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"profile_picture": profile_picture_url}}
        )
        
        return {"profile_picture": profile_picture_url, "message": "Profile photo uploaded successfully"}
    except Exception as e:
        logging.error(f"Profile photo upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload profile photo")

@api_router.get("/users/{user_id}/profile-photo")
async def get_user_profile_photo(user_id: str):
    """Get user profile photo URL"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "profile_picture": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"profile_picture": user.get("profile_picture")}


# ===== MEMORY ROUTES =====

@api_router.post("/memories/upload", response_model=Memory)
async def create_memory_with_file(
    latitude: float = Form(...),
    longitude: float = Form(...),
    content_text: Optional[str] = Form(None),
    memory_type: str = Form(...),
    category: Optional[str] = Form("general"),
    season: Optional[str] = Form(None),
    visibility: Optional[str] = Form("public"),
    visible_to_users: Optional[str] = Form("[]"),
    custom_duration_days: Optional[int] = Form(7),
    file: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user)
):
    # Get user info
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Auto-detect mood if text provided and category is general
    if content_text and category == "general":
        category = await detect_mood_from_text(content_text)
    
    # Handle file upload
    media_url = None
    if file:
        file_extension = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / file_name
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        media_url = f"/api/uploads/{file_name}"
    
    # Parse visible_to_users JSON string
    import json
    try:
        visible_to_users_list = json.loads(visible_to_users) if visible_to_users else []
    except:
        visible_to_users_list = []
    
    # Calculate public_until based on visibility and duration
    # Friends visibility: always permanent (no expiration)
    # Public visibility: can be temporary (2 days, 7 days) or permanent (null)
    public_until = None
    if visibility == "public" and custom_duration_days and custom_duration_days > 0:
        # Temporary public memory with expiration
        public_until = (datetime.now(timezone.utc) + timedelta(days=custom_duration_days)).isoformat()
    # If custom_duration_days is 0 or None, memory is permanent (public_until remains None)
    
    # Create memory
    memory = Memory(
        user_id=user_id,
        username=user["username"],
        user_profile_picture=user.get("profile_picture"),
        latitude=latitude,
        longitude=longitude,
        content_text=content_text,
        media_url=media_url,
        memory_type=memory_type,
        category=category,
        season=season,
        visibility=visibility,
        visible_to_users=visible_to_users_list,
        custom_duration_days=custom_duration_days,
        public_until=public_until
    )
    
    memory_dict = memory.model_dump()
    await db.memories.insert_one(memory_dict)
    
    # Auto-trigger zone generation in background (non-blocking)
    # Check if this memory area now has 5+ memories
    try:
        nearby_memories = await db.memories.find({
            "latitude": {"$gte": latitude - 0.018, "$lte": latitude + 0.018},  # ~2km
            "longitude": {"$gte": longitude - 0.018, "$lte": longitude + 0.018}
        }).to_list(100)
        
        if len(nearby_memories) >= 5:
            # Trigger zone regeneration
            logging.info(f"Memory area has {len(nearby_memories)} memories, triggering zone generation")
            # Note: In production, this should be a background task
            # For now, we'll let users manually trigger via /zones/generate
    except Exception as e:
        logging.warning(f"Zone check error: {e}")
    
    return memory

@api_router.get("/memories", response_model=List[Memory])
async def get_memories(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: float = 50.0,  # km
    user_id: str = Depends(get_current_user)
):
    """Get memories - public ones within 1 hour, friend memories forever"""
    
    # Get user's friends
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}],
        "status": "accepted"
    }).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"])
    
    # Build query
    now = datetime.now(timezone.utc).isoformat()
    query = {
        "$or": [
            # Public temporary memories still active
            {"visibility": "public", "public_until": {"$gt": now}},
            # Public permanent memories (no expiration)
            {"visibility": "public", "public_until": None},
            # Friend memories (always visible, always permanent)
            {"visibility": "friends", "user_id": {"$in": friend_ids}},
            # Own memories (always visible)
            {"user_id": user_id}
        ]
    }
    
    # Add location filter if provided
    if lat is not None and lng is not None:
        # Simple bounding box filter (for production, use geospatial queries)
        lat_range = radius / 111.0  # Rough conversion
        lng_range = radius / (111.0 * abs(lat))
        
        query["latitude"] = {"$gte": lat - lat_range, "$lte": lat + lat_range}
        query["longitude"] = {"$gte": lng - lng_range, "$lte": lng + lng_range}
    
    memories = await db.memories.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return memories

@api_router.get("/memories/{memory_id}", response_model=Memory)
async def get_memory(memory_id: str, user_id: str = Depends(get_current_user)):
    memory = await db.memories.find_one({"id": memory_id}, {"_id": 0})
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory

@api_router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, user_id: str = Depends(get_current_user)):
    memory = await db.memories.find_one({"id": memory_id})
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    if memory["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this memory")
    
    await db.memories.delete_one({"id": memory_id})
    return {"message": "Memory deleted successfully"}

@api_router.get("/memories/my/list", response_model=List[Memory])
async def get_my_memories(user_id: str = Depends(get_current_user)):
    """Get all memories created by the current user"""
    memories = await db.memories.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return memories

@api_router.get("/memories/nearby/friends", response_model=List[Memory])
async def get_nearby_friends_memories(
    lat: float,
    lng: float,
    radius: float = 5.0,  # km
    user_id: str = Depends(get_current_user)
):
    """Get friends' memories within specified radius (default 5km) of user's location"""
    
    # Get user's friends
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}],
        "status": "accepted"
    }).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        friend_id = f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"]
        friend_ids.append(friend_id)
    
    if not friend_ids:
        return []
    
    # Calculate bounding box for the radius
    lat_range = radius / 111.0  # 1 degree latitude ≈ 111 km
    lng_range = radius / (111.0 * abs(lat) if lat != 0 else 111.0)
    
    # Query for friends' memories within radius
    query = {
        "user_id": {"$in": friend_ids},
        "latitude": {"$gte": lat - lat_range, "$lte": lat + lat_range},
        "longitude": {"$gte": lng - lng_range, "$lte": lng + lng_range}
    }
    
    memories = await db.memories.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Filter by exact distance (Haversine formula for more accuracy)
    import math
    
    def haversine_distance(lat1, lon1, lat2, lon2):
        R = 6371  # Earth's radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return R * c
    
    filtered_memories = [
        memory for memory in memories
        if haversine_distance(lat, lng, memory['latitude'], memory['longitude']) <= radius
    ]
    
    return filtered_memories


# ===== ZONE ROUTES =====

@api_router.post("/zones/generate")
async def generate_zones(user_id: str = Depends(get_current_user)):
    """Auto-generate zones from all public memories"""
    try:
        # Get all public memories
        now = datetime.now(timezone.utc).isoformat()
        memories = await db.memories.find({
            "$or": [
                {"public_until": {"$gt": now}},
                {"visibility": "public"}
            ]
        }, {"_id": 0}).to_list(10000)
        
        if len(memories) < 5:
            return {"message": "Not enough memories to create zones", "zones_created": 0}
        
        # Cluster memories by location (2km radius, minimum 5 memories)
        clusters = cluster_memories_by_location(memories, radius_km=2.0)
        
        if not clusters:
            return {"message": "No zones with 5+ memories found", "zones_created": 0}
        
        # Clear existing zones (optional - or merge)
        await db.zones.delete_many({})
        
        zones_created = 0
        for cluster in clusters:
            # Generate AI-powered name and description
            zone_name, zone_description = await generate_zone_name_and_description(
                cluster['memories'],
                cluster['center_lat'],
                cluster['center_lng']
            )
            
            # Create zone
            zone = Zone(
                name=zone_name,
                description=zone_description,
                center_latitude=cluster['center_lat'],
                center_longitude=cluster['center_lng'],
                radius_km=2.0,
                memory_count=len(cluster['memories']),
                memory_ids=[m['id'] for m in cluster['memories']]
            )
            
            await db.zones.insert_one(zone.model_dump())
            zones_created += 1
        
        return {
            "message": f"Successfully generated {zones_created} zones",
            "zones_created": zones_created
        }
    except Exception as e:
        logging.error(f"Zone generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate zones: {str(e)}")

@api_router.get("/zones")
async def get_zones(user_id: str = Depends(get_current_user)):
    """Get all zones"""
    zones = await db.zones.find({}, {"_id": 0}).sort("memory_count", -1).to_list(1000)
    return zones

@api_router.get("/zones/{zone_id}")
async def get_zone(zone_id: str, user_id: str = Depends(get_current_user)):
    """Get specific zone details"""
    zone = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone

@api_router.get("/zones/{zone_id}/memories")
async def get_zone_memories(
    zone_id: str,
    sort_by: Optional[str] = "date",  # date or friends
    user_id: str = Depends(get_current_user)
):
    """Get memories in a zone with sorting and filtering options"""
    # Get zone
    zone = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    # Get user's friends for filtering
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}],
        "status": "accepted"
    }).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"])
    
    # Get memories in zone
    memory_ids = zone.get('memory_ids', [])
    if not memory_ids:
        return {"zone": zone, "memories": [], "friends_memories": []}
    
    memories = await db.memories.find(
        {"id": {"$in": memory_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Sort by date (newest first)
    if sort_by == "date":
        memories.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    # Separate friends' memories
    friends_memories = [m for m in memories if m['user_id'] in friend_ids or m['user_id'] == user_id]
    
    return {
        "zone": zone,
        "all_memories": memories,
        "friends_memories": friends_memories
    }


# ===== FRIEND ROUTES =====

@api_router.post("/friends/request")
async def send_friend_request(request: FriendRequest, user_id: str = Depends(get_current_user)):
    # Check if user exists
    to_user = await db.users.find_one({"id": request.to_user_id})
    if not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.to_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if friendship already exists
    existing = await db.friendships.find_one({
        "$or": [
            {"user_id_1": user_id, "user_id_2": request.to_user_id},
            {"user_id_1": request.to_user_id, "user_id_2": user_id}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    # Create friendship
    friendship = Friendship(
        user_id_1=user_id,
        user_id_2=request.to_user_id,
        status="pending"
    )
    
    await db.friendships.insert_one(friendship.model_dump())
    return {"message": "Friend request sent successfully"}

@api_router.get("/friends/requests")
async def get_friend_requests(user_id: str = Depends(get_current_user)):
    """Get pending friend requests received"""
    requests = await db.friendships.find({
        "user_id_2": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Enrich with user info
    for req in requests:
        user = await db.users.find_one({"id": req["user_id_1"]}, {"_id": 0, "password_hash": 0})
        req["from_user"] = user
    
    return requests

@api_router.post("/friends/accept/{friendship_id}")
async def accept_friend_request(friendship_id: str, user_id: str = Depends(get_current_user)):
    friendship = await db.friendships.find_one({"id": friendship_id})
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friendship["user_id_2"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friendships.update_one(
        {"id": friendship_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Friend request accepted"}

@api_router.post("/friends/reject/{friendship_id}")
async def reject_friend_request(friendship_id: str, user_id: str = Depends(get_current_user)):
    friendship = await db.friendships.find_one({"id": friendship_id})
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friendship["user_id_2"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friendships.delete_one({"id": friendship_id})
    return {"message": "Friend request rejected"}

@api_router.get("/friends")
async def get_friends(user_id: str = Depends(get_current_user)):
    """Get accepted friends"""
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}],
        "status": "accepted"
    }, {"_id": 0}).to_list(1000)
    
    friends = []
    for f in friendships:
        friend_id = f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"]
        user = await db.users.find_one({"id": friend_id}, {"_id": 0, "password_hash": 0})
        if user:
            friends.append(user)
    
    return friends

@api_router.get("/users/search")
async def search_users(q: str, user_id: str = Depends(get_current_user)):
    """Search users by username or email"""
    users = await db.users.find({
        "$or": [
            {"username": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}}
        ],
        "id": {"$ne": user_id}  # Exclude current user
    }, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)
    
    return users


# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
