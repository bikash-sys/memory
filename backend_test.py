import requests
import sys
import json
from datetime import datetime

class BangaloreMemoryMapTester:
    def __init__(self, base_url="https://bugscanner-3.preview.emergentagent.com"):
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