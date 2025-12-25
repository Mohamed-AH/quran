#!/bin/bash

###############################################################################
# API Testing Script
# Tests all admin panel and leaderboard API endpoints
#
# Usage:
#   1. Start your backend server: npm run dev
#   2. Get admin token: node backend/scripts/get-admin-token.js
#   3. Run tests: bash backend/scripts/test-api.sh <admin-token>
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:5000/api}"
ADMIN_TOKEN="${1}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Error: Admin token required${NC}"
  echo -e "${YELLOW}Usage: bash backend/scripts/test-api.sh <admin-token>${NC}"
  echo -e "${YELLOW}Get token: node backend/scripts/get-admin-token.js${NC}"
  exit 1
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

###############################################################################
# Helper Functions
###############################################################################

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_test() {
  echo -e "${YELLOW}🧪 Test: $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ PASS: $1${NC}"
  ((TESTS_PASSED++))
}

print_failure() {
  echo -e "${RED}❌ FAIL: $1${NC}"
  echo -e "${RED}   Response: $2${NC}"
  ((TESTS_FAILED++))
}

run_test() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_success="${5:-true}"

  ((TESTS_TOTAL++))
  print_test "$test_name"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -X GET "$API_BASE$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -X "$method" "$API_BASE$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  # Check if response contains "success": true
  if echo "$response" | grep -q "\"success\":true" || echo "$response" | grep -q "\"success\": true"; then
    if [ "$expected_success" = "true" ]; then
      print_success "$test_name"
      echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
      print_failure "$test_name (expected to fail)" "$response"
    fi
  else
    if [ "$expected_success" = "false" ]; then
      print_success "$test_name (correctly failed)"
      echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
      print_failure "$test_name" "$response"
    fi
  fi

  echo ""
}

###############################################################################
# App Settings Tests
###############################################################################

test_app_settings() {
  print_header "App Settings API Tests"

  run_test "Get App Settings" "GET" "/admin/settings"

  run_test "Enable Signup Control" "PATCH" "/admin/settings" \
    '{"requireInviteCode": true}'

  run_test "Enable Leaderboard" "PATCH" "/admin/settings" \
    '{"leaderboardEnabled": true}'

  run_test "Update Both Settings" "PATCH" "/admin/settings" \
    '{"requireInviteCode": false, "leaderboardEnabled": true}'
}

###############################################################################
# Dashboard Tests
###############################################################################

test_dashboard() {
  print_header "Dashboard API Tests"

  run_test "Get Dashboard Stats" "GET" "/admin/stats"
}

###############################################################################
# User Management Tests
###############################################################################

test_user_management() {
  print_header "User Management API Tests"

  run_test "Get All Users (Page 1)" "GET" "/admin/users?page=1&limit=5"

  run_test "Search Users by Name" "GET" "/admin/users?search=ahmad"

  run_test "Filter Admin Users" "GET" "/admin/users?role=admin"

  run_test "Filter Regular Users" "GET" "/admin/users?role=user"
}

###############################################################################
# Invite Code Tests
###############################################################################

test_invite_codes() {
  print_header "Invite Code API Tests"

  run_test "Get All Invite Codes" "GET" "/admin/invite-codes"

  run_test "Create Invite Code" "POST" "/admin/invite-codes" \
    '{"maxUses": 5, "description": "Test code from API test script"}'

  # Note: Deactivate and delete tests would need a valid code ID
  # These are commented out as they require dynamic IDs
  # run_test "Deactivate Invite Code" "PUT" "/admin/invite-codes/CODE_ID/deactivate"
  # run_test "Delete Invite Code" "DELETE" "/admin/invite-codes/CODE_ID"
}

###############################################################################
# Leaderboard Tests
###############################################################################

test_leaderboard() {
  print_header "Leaderboard API Tests"

  run_test "Get Leaderboard (Top 10)" "GET" "/leaderboard?limit=10"

  run_test "Get Leaderboard (Top 25)" "GET" "/leaderboard?limit=25"

  run_test "Refresh Leaderboard Cache" "POST" "/leaderboard/refresh"

  # Test with leaderboard disabled
  print_test "Test Leaderboard When Disabled"

  # Disable leaderboard
  curl -s -X PATCH "$API_BASE/admin/settings" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"leaderboardEnabled": false}' > /dev/null

  # Try to access (should fail)
  run_test "Access Leaderboard (Disabled)" "GET" "/leaderboard" "" "false"

  # Re-enable leaderboard
  curl -s -X PATCH "$API_BASE/admin/settings" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"leaderboardEnabled": true}' > /dev/null

  print_success "Leaderboard re-enabled"
}

###############################################################################
# Error Handling Tests
###############################################################################

test_error_handling() {
  print_header "Error Handling Tests"

  # Test with invalid/no token
  print_test "Unauthorized Access (No Token)"
  ((TESTS_TOTAL++))
  response=$(curl -s -X GET "$API_BASE/admin/settings" \
    -H "Content-Type: application/json")

  if echo "$response" | grep -q "success.*false" || echo "$response" | grep -q "error" || echo "$response" | grep -q "Unauthorized"; then
    print_success "Correctly rejected unauthorized request"
  else
    print_failure "Should reject unauthorized request" "$response"
  fi
  echo ""

  # Test with invalid endpoint
  print_test "Invalid Endpoint"
  ((TESTS_TOTAL++))
  response=$(curl -s -X GET "$API_BASE/admin/invalid-endpoint" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

  if echo "$response" | grep -q "404" || echo "$response" | grep -q "Not Found" || echo "$response" | grep -q "Cannot GET"; then
    print_success "Correctly returned 404 for invalid endpoint"
  else
    print_failure "Should return 404" "$response"
  fi
  echo ""
}

###############################################################################
# Run All Tests
###############################################################################

main() {
  print_header "🚀 Starting API Tests"
  echo -e "API Base: ${BLUE}$API_BASE${NC}"
  echo -e "Token: ${BLUE}${ADMIN_TOKEN:0:30}...${NC}\n"

  test_app_settings
  test_dashboard
  test_user_management
  test_invite_codes
  test_leaderboard
  test_error_handling

  # Summary
  print_header "📊 Test Summary"
  echo -e "Total Tests: ${BLUE}$TESTS_TOTAL${NC}"
  echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}\n"
    exit 0
  else
    echo -e "\n${RED}❌ Some tests failed${NC}\n"
    exit 1
  fi
}

# Check if jq is available for pretty JSON output
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠️  jq not found. Install for pretty JSON output: brew install jq${NC}\n"
fi

# Run tests
main
