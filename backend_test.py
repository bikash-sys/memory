import requests
import sys
import json
from datetime import datetime

class BangaloreMemoryMapTester:
    def __init__(self, base_url="https://locale-memory.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if files:
                # Remove Content-Type for multipart/form-data
                headers.pop('Content-Type', None)
            
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json() if response.content else {}
                    self.log_test(name, True, f"Status: {response.status_code}")
                    return True, response_data
                except:
                    self.log_test(name, True, f"Status: {response.status_code} (No JSON response)")
                    return True, {}
            else:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                except:
                    error_detail = response.text[:100] if response.text else 'No error details'
                
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}. Error: {error_detail}")
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "TestPass123!",
            "phone": "+91 9876543210"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        # First register a user
        timestamp = datetime.now().strftime('%H%M%S')
        register_data = {
            "username": f"loginuser_{timestamp}",
            "email": f"login_{timestamp}@example.com",
            "password": "LoginPass123!"
        }
        
        # Register
        success, _ = self.run_test(
            "Pre-Login Registration",
            "POST",
            "auth/register",
            200,
            data=register_data
        )
        
        if not success:
            return False
        
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        return success and 'token' in response

    def test_get_current_user(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get Current User", False, "No token available")
            return False
        
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        return success and 'username' in response

    def test_create_memory(self):
        """Test creating a memory"""
        if not self.token:
            self.log_test("Create Memory", False, "No token available")
            return False
        
        # Test data for Bangalore location - using form data format
        memory_data = {
            'latitude': 12.9716,
            'longitude': 77.5946,
            'content_text': 'Testing memory creation at Bangalore center. This is a happy memory!',
            'memory_type': 'text',
            'category': 'general'
        }
        
        # Use custom request for form data
        url = f"{self.base_url}/api/memories/upload"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print(f"\n🔍 Testing Create Memory...")
        print(f"   URL: {url}")
        
        try:
            response = requests.post(url, data=memory_data, headers=headers)
            success = response.status_code == 200
            
            if success:
                try:
                    response_data = response.json()
                    self.log_test("Create Memory", True, f"Status: {response.status_code}")
                    if 'id' in response_data:
                        self.memory_id = response_data['id']
                    return True
                except:
                    self.log_test("Create Memory", True, f"Status: {response.status_code} (No JSON response)")
                    return True
            else:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                except:
                    error_detail = response.text[:200] if response.text else 'No error details'
                
                self.log_test("Create Memory", False, f"Expected 200, got {response.status_code}. Error: {error_detail}")
                return False
                
        except Exception as e:
            self.log_test("Create Memory", False, f"Exception: {str(e)}")
            return False

    def test_get_memories(self):
        """Test getting memories"""
        if not self.token:
            self.log_test("Get Memories", False, "No token available")
            return False
        
        success, response = self.run_test(
            "Get Memories",
            "GET",
            "memories",
            200
        )
        
        return success and isinstance(response, list)

    def test_search_users(self):
        """Test user search functionality"""
        if not self.token:
            self.log_test("Search Users", False, "No token available")
            return False
        
        success, response = self.run_test(
            "Search Users",
            "GET",
            "users/search?q=test",
            200
        )
        
        return success and isinstance(response, list)

    def test_friend_request_flow(self):
        """Test complete friend request flow"""
        if not self.token:
            self.log_test("Friend Request Flow", False, "No token available")
            return False
        
        # Create another user first
        timestamp = datetime.now().strftime('%H%M%S')
        friend_data = {
            "username": f"friend_{timestamp}",
            "email": f"friend_{timestamp}@example.com",
            "password": "FriendPass123!"
        }
        
        success, friend_response = self.run_test(
            "Create Friend User",
            "POST",
            "auth/register",
            200,
            data=friend_data
        )
        
        if not success or 'user' not in friend_response:
            return False
        
        friend_id = friend_response['user']['id']
        
        # Send friend request
        request_data = {"to_user_id": friend_id}
        success, _ = self.run_test(
            "Send Friend Request",
            "POST",
            "friends/request",
            200,
            data=request_data
        )
        
        if not success:
            return False
        
        # Get friend requests (should be empty for current user since they sent the request)
        success, _ = self.run_test(
            "Get Friend Requests",
            "GET",
            "friends/requests",
            200
        )
        
        if not success:
            return False
        
        # Get friends list (should be empty since request not accepted)
        success, _ = self.run_test(
            "Get Friends List",
            "GET",
            "friends",
            200
        )
        
        return success

    def test_mood_detection_comprehensive(self):
        """Comprehensive test of mood detection endpoint as per review requirements"""
        print("\n🎯 COMPREHENSIVE MOOD DETECTION TESTS (Gemini API)")
        
        # Test 1: Authentication Tests
        print("\n🔐 Testing Authentication Requirements...")
        
        # Test without auth token
        original_token = self.token
        self.token = None
        success_no_auth, _ = self.run_test(
            "Mood Detection - No Auth Token",
            "POST",
            "detect-mood",
            401,
            data={"text": "Test text"}
        )
        
        # Test with invalid token
        self.token = "invalid_token_12345"
        success_invalid_auth, _ = self.run_test(
            "Mood Detection - Invalid Auth Token", 
            "POST",
            "detect-mood",
            401,
            data={"text": "Test text"}
        )
        
        # Restore valid token
        self.token = original_token
        
        if not self.token:
            self.log_test("Mood Detection Authentication Tests", False, "No valid token available")
            return False
        
        # Test 2: Empty text handling
        print("\n📝 Testing Empty Text Handling...")
        success_empty, response_empty = self.run_test(
            "Mood Detection - Empty Text",
            "POST", 
            "detect-mood",
            200,
            data={"text": ""}
        )
        
        empty_text_valid = False
        if success_empty and 'mood' in response_empty:
            mood = response_empty['mood']
            if mood == "general":
                self.log_test("Empty Text Fallback", True, f"Correctly returned 'general' for empty text")
                empty_text_valid = True
            else:
                self.log_test("Empty Text Fallback", False, f"Expected 'general', got '{mood}'")
        
        # Test 3: Comprehensive mood detection with various texts
        print("\n🎭 Testing Mood Categories...")
        test_cases = [
            {
                "text": "I had the best day ever! Everything went perfectly and I'm so excited!",
                "description": "Happy text - excitement and joy"
            },
            {
                "text": "I'm feeling down today. Things didn't go as planned and I'm disappointed.",
                "description": "Sad text - disappointment and sadness"
            },
            {
                "text": "I love spending time with you. Every moment together feels magical.",
                "description": "Romantic text - love and affection"
            },
            {
                "text": "Looking at old photos reminds me of wonderful childhood memories. I miss those days.",
                "description": "Nostalgic text - reminiscing about past"
            },
            {
                "text": "That joke was hilarious! I can't stop laughing. LOL 😂",
                "description": "Funny text - humor and laughter"
            },
            {
                "text": "I went to the store and bought some groceries.",
                "description": "General/neutral text - everyday activity"
            }
        ]
        
        valid_moods = ["happy", "romantic", "sad", "nostalgic", "funny", "general"]
        mood_tests_passed = 0
        response_times = []
        
        import time
        
        for case in test_cases:
            start_time = time.time()
            success, response = self.run_test(
                f"Mood Detection - {case['description']}",
                "POST",
                "detect-mood", 
                200,
                data={"text": case["text"]}
            )
            end_time = time.time()
            response_time = end_time - start_time
            response_times.append(response_time)
            
            if success and 'mood' in response:
                detected_mood = response['mood']
                if detected_mood in valid_moods:
                    self.log_test(f"Mood Validation - {case['description']}", True, 
                                f"Detected: '{detected_mood}' (valid category, {response_time:.2f}s)")
                    mood_tests_passed += 1
                else:
                    self.log_test(f"Mood Validation - {case['description']}", False, 
                                f"Invalid mood: '{detected_mood}'")
        
        # Test 4: Response time validation
        print("\n⏱️ Testing Response Times...")
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        response_time_ok = max_response_time < 5.0  # Should be under 5 seconds as per requirements
        
        if response_time_ok:
            self.log_test("Response Time Validation", True, 
                        f"Average: {avg_response_time:.2f}s, Max: {max_response_time:.2f}s (under 5s limit)")
        else:
            self.log_test("Response Time Validation", False, 
                        f"Max response time {max_response_time:.2f}s exceeds 5s limit")
        
        # Test 5: API Response Structure Validation
        print("\n🔍 Testing API Response Structure...")
        success_structure, response_structure = self.run_test(
            "Mood Detection - Response Structure",
            "POST",
            "detect-mood",
            200,
            data={"text": "Test response structure"}
        )
        
        structure_valid = False
        if success_structure:
            has_mood_field = 'mood' in response_structure
            if has_mood_field:
                mood_value = response_structure['mood']
                is_string = isinstance(mood_value, str)
                is_valid_category = mood_value in valid_moods
                
                if is_string and is_valid_category:
                    self.log_test("Response Structure Validation", True, 
                                f"Valid structure: mood='{mood_value}' (string, valid category)")
                    structure_valid = True
                else:
                    issues = []
                    if not is_string:
                        issues.append("mood is not string")
                    if not is_valid_category:
                        issues.append(f"invalid category '{mood_value}'")
                    self.log_test("Response Structure Validation", False, 
                                f"Issues: {', '.join(issues)}")
            else:
                self.log_test("Response Structure Validation", False, "Missing 'mood' field in response")
        
        # Overall assessment
        all_auth_tests = success_no_auth and success_invalid_auth
        all_mood_tests = mood_tests_passed == len(test_cases)
        
        print(f"\n📊 MOOD DETECTION TEST SUMMARY:")
        print(f"   ✅ Authentication Tests: {'PASS' if all_auth_tests else 'FAIL'}")
        print(f"   ✅ Empty Text Handling: {'PASS' if empty_text_valid else 'FAIL'}")
        print(f"   ✅ Mood Category Tests: {mood_tests_passed}/{len(test_cases)} PASS")
        print(f"   ✅ Response Time: {'PASS' if response_time_ok else 'FAIL'}")
        print(f"   ✅ Response Structure: {'PASS' if structure_valid else 'FAIL'}")
        
        return all_auth_tests and empty_text_valid and all_mood_tests and response_time_ok and structure_valid

    def test_profile_update(self):
        """Test profile update functionality"""
        if not self.token:
            self.log_test("Profile Update", False, "No token available")
            return False
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Test 1: Update username only
        username_data = {"username": f"updated_user_{timestamp}"}
        success1, response1 = self.run_test(
            "Profile Update - Username Only",
            "PUT",
            "users/profile",
            200,
            data=username_data
        )
        
        # Test 2: Update city and region
        location_data = {
            "city": "Bangalore",
            "region": "Karnataka"
        }
        success2, response2 = self.run_test(
            "Profile Update - City and Region",
            "PUT", 
            "users/profile",
            200,
            data=location_data
        )
        
        # Test 3: Update all fields together
        all_data = {
            "username": f"complete_user_{timestamp}",
            "city": "Mysore", 
            "region": "Karnataka"
        }
        success3, response3 = self.run_test(
            "Profile Update - All Fields",
            "PUT",
            "users/profile", 
            200,
            data=all_data
        )
        
        # Test 4: Username uniqueness validation
        # First create another user
        other_user_data = {
            "username": f"other_user_{timestamp}",
            "email": f"other_{timestamp}@example.com",
            "password": "OtherPass123!"
        }
        
        success4, other_response = self.run_test(
            "Create Other User for Uniqueness Test",
            "POST",
            "auth/register",
            200,
            data=other_user_data
        )
        
        # Try to update current user's username to the other user's username
        if success4:
            duplicate_username_data = {"username": f"other_user_{timestamp}"}
            success5, _ = self.run_test(
                "Profile Update - Username Uniqueness Validation",
                "PUT",
                "users/profile",
                400,  # Should fail with 400
                data=duplicate_username_data
            )
        else:
            success5 = False
        
        return success1 and success2 and success3 and success4 and success5

    def test_profile_retrieval(self):
        """Test profile retrieval with city and region fields"""
        if not self.token:
            self.log_test("Profile Retrieval", False, "No token available")
            return False
        
        # First update profile with city and region
        profile_data = {
            "city": "Bangalore",
            "region": "Karnataka"
        }
        
        update_success, _ = self.run_test(
            "Profile Setup for Retrieval Test",
            "PUT",
            "users/profile",
            200,
            data=profile_data
        )
        
        if not update_success:
            return False
        
        # Now retrieve profile and verify fields
        success, response = self.run_test(
            "Profile Retrieval - Verify City/Region Fields",
            "GET",
            "auth/me",
            200
        )
        
        if success:
            has_city = 'city' in response
            has_region = 'region' in response
            
            if has_city and has_region:
                self.log_test("Profile Fields Validation", True, 
                            f"City: {response.get('city')}, Region: {response.get('region')}")
                return True
            else:
                missing_fields = []
                if not has_city:
                    missing_fields.append('city')
                if not has_region:
                    missing_fields.append('region')
                self.log_test("Profile Fields Validation", False, 
                            f"Missing fields: {', '.join(missing_fields)}")
                return False
        
        return False

    def test_zone_system_comprehensive(self):
        """Comprehensive test of the zone system as per review requirements"""
        print("\n🌟 COMPREHENSIVE ZONE SYSTEM TESTS")
        
        if not self.token:
            self.log_test("Zone System Tests", False, "No token available")
            return False
        
        # Step 1: Create multiple test users for diverse memories
        print("\n👥 Creating Test Users...")
        test_users = []
        timestamp = datetime.now().strftime('%H%M%S')
        
        for i in range(3):
            user_data = {
                "username": f"zoneuser_{i}_{timestamp}",
                "email": f"zoneuser_{i}_{timestamp}@example.com",
                "password": f"ZonePass{i}123!"
            }
            
            success, response = self.run_test(
                f"Create Zone Test User {i+1}",
                "POST",
                "auth/register",
                200,
                data=user_data
            )
            
            if success and 'token' in response:
                test_users.append({
                    'token': response['token'],
                    'user_id': response['user']['id'],
                    'username': response['user']['username']
                })
        
        if len(test_users) < 2:
            self.log_test("Zone System Setup", False, "Failed to create enough test users")
            return False
        
        # Step 2: Create clustered memories (some close together, some far apart)
        print("\n📍 Creating Clustered Memories...")
        
        # Bangalore locations for clustering
        bangalore_clusters = [
            # Cluster 1: Koramangala area (close together)
            [
                {"lat": 12.9279, "lng": 77.6271, "text": "Amazing coffee at Third Wave Coffee! Perfect start to my day ☕", "mood": "happy"},
                {"lat": 12.9285, "lng": 77.6275, "text": "Shopping at Forum Mall was so much fun with friends 🛍️", "mood": "happy"},
                {"lat": 12.9290, "lng": 77.6280, "text": "Romantic dinner at Toit brewery with my partner 💕", "mood": "romantic"},
                {"lat": 12.9275, "lng": 77.6265, "text": "Nostalgic walk through my old neighborhood, so many memories here", "mood": "nostalgic"},
                {"lat": 12.9282, "lng": 77.6278, "text": "Hilarious comedy show at The Humming Tree! Couldn't stop laughing 😂", "mood": "funny"},
                {"lat": 12.9288, "lng": 77.6272, "text": "Peaceful morning jog in the park, feeling grateful", "mood": "general"}
            ],
            # Cluster 2: Indiranagar area (close together)
            [
                {"lat": 12.9784, "lng": 77.6408, "text": "Love the vibrant street art in Indiranagar! So inspiring 🎨", "mood": "happy"},
                {"lat": 12.9790, "lng": 77.6415, "text": "Cozy evening at Cafe Coffee Day with old friends", "mood": "nostalgic"},
                {"lat": 12.9788, "lng": 77.6412, "text": "Romantic sunset from the rooftop restaurant 🌅", "mood": "romantic"},
                {"lat": 12.9786, "lng": 77.6410, "text": "Funny incident at the local market, vendor was so witty!", "mood": "funny"},
                {"lat": 12.9792, "lng": 77.6418, "text": "Feeling a bit down after a tough day at work", "mood": "sad"}
            ],
            # Isolated memories (far from clusters - should not form zones)
            [
                {"lat": 12.8500, "lng": 77.5000, "text": "Solo trip to outskirts, peaceful but lonely", "mood": "general"},
                {"lat": 13.1000, "lng": 77.8000, "text": "Work meeting at distant office location", "mood": "general"}
            ]
        ]
        
        created_memories = []
        
        # Create memories using different users
        for cluster_idx, cluster in enumerate(bangalore_clusters):
            for memory_idx, memory_data in enumerate(cluster):
                # Rotate between users
                user = test_users[memory_idx % len(test_users)]
                
                # Temporarily switch to this user's token
                original_token = self.token
                self.token = user['token']
                
                # Create memory using form data
                url = f"{self.base_url}/api/memories/upload"
                headers = {'Authorization': f'Bearer {self.token}'}
                
                form_data = {
                    'latitude': memory_data['lat'],
                    'longitude': memory_data['lng'],
                    'content_text': memory_data['text'],
                    'memory_type': 'text',
                    'category': memory_data['mood']
                }
                
                try:
                    response = requests.post(url, data=form_data, headers=headers)
                    if response.status_code == 200:
                        memory_response = response.json()
                        created_memories.append(memory_response)
                        self.log_test(f"Create Memory {cluster_idx+1}-{memory_idx+1}", True, 
                                    f"Created at ({memory_data['lat']:.4f}, {memory_data['lng']:.4f})")
                    else:
                        self.log_test(f"Create Memory {cluster_idx+1}-{memory_idx+1}", False, 
                                    f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test(f"Create Memory {cluster_idx+1}-{memory_idx+1}", False, f"Exception: {str(e)}")
                
                # Restore original token
                self.token = original_token
        
        print(f"   Created {len(created_memories)} memories for zone testing")
        
        # Step 3: Test POST /api/zones/generate
        print("\n🔄 Testing Zone Generation...")
        
        success_generate, generate_response = self.run_test(
            "Zone Generation - POST /api/zones/generate",
            "POST",
            "zones/generate",
            200
        )
        
        zones_created = 0
        if success_generate and 'zones_created' in generate_response:
            zones_created = generate_response['zones_created']
            self.log_test("Zone Generation Count", True, f"Created {zones_created} zones")
        
        # Step 4: Test GET /api/zones
        print("\n📋 Testing Zone Listing...")
        
        success_list, zones_list = self.run_test(
            "Zone Listing - GET /api/zones",
            "GET",
            "zones",
            200
        )
        
        zone_list_valid = False
        zone_ids = []
        if success_list and isinstance(zones_list, list):
            zone_list_valid = True
            zone_ids = [zone['id'] for zone in zones_list if 'id' in zone]
            
            # Validate zone structure
            for zone in zones_list:
                required_fields = ['id', 'name', 'description', 'center_latitude', 'center_longitude', 'radius_km', 'memory_count', 'memory_ids']
                missing_fields = [field for field in required_fields if field not in zone]
                
                if missing_fields:
                    self.log_test(f"Zone Structure Validation", False, f"Missing fields: {missing_fields}")
                    zone_list_valid = False
                else:
                    # Check AI-generated names (should not be just "Memory Zone")
                    if zone['name'] != "Memory Zone" and len(zone['name']) > 5:
                        self.log_test(f"AI Zone Naming", True, f"Zone: '{zone['name']}' - '{zone['description']}'")
                    else:
                        self.log_test(f"AI Zone Naming", False, f"Generic name: '{zone['name']}'")
        
        # Step 5: Test GET /api/zones/{zone_id}
        print("\n🔍 Testing Individual Zone Details...")
        
        zone_detail_success = True
        if zone_ids:
            test_zone_id = zone_ids[0]
            success_detail, zone_detail = self.run_test(
                f"Zone Details - GET /api/zones/{test_zone_id}",
                "GET",
                f"zones/{test_zone_id}",
                200
            )
            
            if not success_detail:
                zone_detail_success = False
        else:
            self.log_test("Zone Details Test", False, "No zones available to test")
            zone_detail_success = False
        
        # Step 6: Test GET /api/zones/{zone_id}/memories with filters
        print("\n🎯 Testing Zone Memory Retrieval with Filters...")
        
        zone_memories_success = True
        if zone_ids:
            test_zone_id = zone_ids[0]
            
            # Test 1: Get all memories in zone
            success_all, memories_all = self.run_test(
                f"Zone Memories - All (GET /api/zones/{test_zone_id}/memories)",
                "GET",
                f"zones/{test_zone_id}/memories",
                200
            )
            
            # Test 2: Get memories sorted by date
            success_date, memories_date = self.run_test(
                f"Zone Memories - Date Sort (GET /api/zones/{test_zone_id}/memories?sort_by=date)",
                "GET",
                f"zones/{test_zone_id}/memories?sort_by=date",
                200
            )
            
            # Validate response structure
            if success_all and isinstance(memories_all, dict):
                required_keys = ['zone', 'all_memories', 'friends_memories']
                missing_keys = [key for key in required_keys if key not in memories_all]
                
                if missing_keys:
                    self.log_test("Zone Memories Structure", False, f"Missing keys: {missing_keys}")
                    zone_memories_success = False
                else:
                    self.log_test("Zone Memories Structure", True, "All required keys present")
                    
                    # Check if memories are properly sorted by date (newest first)
                    all_memories = memories_all.get('all_memories', [])
                    if len(all_memories) > 1:
                        dates = [mem.get('created_at', '') for mem in all_memories]
                        is_sorted = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
                        self.log_test("Zone Memories Date Sorting", is_sorted, 
                                    f"Memories sorted by date: {is_sorted}")
            else:
                zone_memories_success = False
        else:
            self.log_test("Zone Memories Test", False, "No zones available to test")
            zone_memories_success = False
        
        # Step 7: Test zone clustering logic validation
        print("\n🧮 Validating Zone Clustering Logic...")
        
        clustering_valid = True
        if success_list and zones_list:
            for zone in zones_list:
                memory_count = zone.get('memory_count', 0)
                radius_km = zone.get('radius_km', 0)
                
                # Validate minimum 5 memories per zone
                if memory_count < 5:
                    self.log_test("Zone Clustering - Minimum Memories", False, 
                                f"Zone has only {memory_count} memories (minimum 5 required)")
                    clustering_valid = False
                
                # Validate 2km radius
                if radius_km != 2.0:
                    self.log_test("Zone Clustering - Radius", False, 
                                f"Zone radius is {radius_km}km (expected 2.0km)")
                    clustering_valid = False
            
            if clustering_valid:
                self.log_test("Zone Clustering Logic", True, "All zones meet clustering requirements")
        
        # Step 8: Test authentication requirements for all endpoints
        print("\n🔐 Testing Zone Authentication Requirements...")
        
        original_token = self.token
        self.token = None
        
        auth_tests = [
            ("zones/generate", "POST"),
            ("zones", "GET"),
        ]
        
        auth_success = True
        for endpoint, method in auth_tests:
            success, _ = self.run_test(
                f"Zone Auth - {method} {endpoint}",
                method,
                endpoint,
                401
            )
            if not success:
                auth_success = False
        
        # Restore token
        self.token = original_token
        
        # Overall assessment
        print(f"\n📊 ZONE SYSTEM TEST SUMMARY:")
        print(f"   ✅ Zone Generation: {'PASS' if success_generate else 'FAIL'}")
        print(f"   ✅ Zone Listing: {'PASS' if zone_list_valid else 'FAIL'}")
        print(f"   ✅ Zone Details: {'PASS' if zone_detail_success else 'FAIL'}")
        print(f"   ✅ Zone Memories: {'PASS' if zone_memories_success else 'FAIL'}")
        print(f"   ✅ Clustering Logic: {'PASS' if clustering_valid else 'FAIL'}")
        print(f"   ✅ Authentication: {'PASS' if auth_success else 'FAIL'}")
        print(f"   📈 Zones Created: {zones_created}")
        
        return (success_generate and zone_list_valid and zone_detail_success and 
                zone_memories_success and clustering_valid and auth_success)

    def test_invalid_endpoints(self):
        """Test error handling for invalid requests"""
        # Test invalid login
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpass"}
        )
        
        if not success:
            return False
        
        # Test duplicate registration
        if self.token:
            # Try to register with same email
            duplicate_data = {
                "username": "duplicate",
                "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
                "password": "TestPass123!"
            }
            
            # Register once
            self.run_test("First Registration", "POST", "auth/register", 200, data=duplicate_data)
            
            # Try to register again with same email
            success, _ = self.run_test(
                "Duplicate Email Registration",
                "POST",
                "auth/register",
                400,
                data=duplicate_data
            )
            
            return success
        
        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Namma Memories API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        
        # NEW FEATURES TESTS (as requested in review)
        print("\n📋 NEW FEATURES TESTS")
        self.test_mood_detection_comprehensive()
        
        print("🎯 Testing Profile Update Functionality...")
        self.test_profile_update()
        
        print("🎯 Testing Profile Retrieval with City/Region...")
        self.test_profile_retrieval()
        
        # Memory Tests
        print("\n📋 MEMORY TESTS")
        self.test_create_memory()
        self.test_get_memories()
        
        # Friend System Tests
        print("\n📋 FRIEND SYSTEM TESTS")
        self.test_search_users()
        self.test_friend_request_flow()
        
        # Error Handling Tests
        print("\n📋 ERROR HANDLING TESTS")
        self.test_invalid_endpoints()
        
        # Print Summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        else:
            print(f"\n✅ ALL TESTS PASSED!")
        
        return self.tests_passed == self.tests_run

def main():
    tester = BangaloreMemoryMapTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())