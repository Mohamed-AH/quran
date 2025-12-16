#!/bin/bash

##############################################
# Phase 4 CRUD API Test Script
# Tests all User, Logs, and Juz endpoints
##############################################

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_URL="http://localhost:5000"

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Bearer token required${NC}"
    echo "Usage: ./test-phase4.sh YOUR_ACCESS_TOKEN"
    echo ""
    echo "To get a token:"
    echo "1. Start the server: npm start"
    echo "2. Visit: http://localhost:5000/api/auth/google or http://localhost:5000/api/auth/github"
    echo "3. Copy the accessToken from the response"
    exit 1
fi

TOKEN=$1

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 4 CRUD API Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test counter
PASS=0
FAIL=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5

    echo -e "${YELLOW}Testing: $name${NC}"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        echo "$body"
        ((FAIL++))
    fi
    echo ""
}

##############################################
# 1. USER ENDPOINTS
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}1. Testing User Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get current user
test_endpoint "GET /api/user - Get current user profile" \
    "GET" "/api/user" "" 200

# Update user profile
test_endpoint "PUT /api/user - Update user profile" \
    "PUT" "/api/user" \
    '{"name":"Test User","language":"ar","theme":"dark"}' \
    200

# Verify update
test_endpoint "GET /api/user - Verify profile update" \
    "GET" "/api/user" "" 200

##############################################
# 2. JUZ ENDPOINTS
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}2. Testing Juz Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get all Juz (should auto-initialize if empty)
test_endpoint "GET /api/juz - Get all 30 Juz (auto-init)" \
    "GET" "/api/juz" "" 200

# Get Juz summary
test_endpoint "GET /api/juz/summary - Get Juz summary" \
    "GET" "/api/juz/summary" "" 200

# Get single Juz
test_endpoint "GET /api/juz/1 - Get Juz #1" \
    "GET" "/api/juz/1" "" 200

# Update Juz
test_endpoint "PUT /api/juz/1 - Update Juz #1 (set pages to 5)" \
    "PUT" "/api/juz/1" \
    '{"pages":5,"notes":"Started Juz 1"}' \
    200

# Verify Juz update
test_endpoint "GET /api/juz/1 - Verify Juz update" \
    "GET" "/api/juz/1" "" 200

# Update Juz to completed status
test_endpoint "PUT /api/juz/1 - Complete Juz #1 (set pages to 20)" \
    "PUT" "/api/juz/1" \
    '{"pages":20,"notes":"Completed Juz 1","completionDate":"2024-12-15T00:00:00.000Z"}' \
    200

# Get updated summary
test_endpoint "GET /api/juz/summary - Get updated summary" \
    "GET" "/api/juz/summary" "" 200

##############################################
# 3. LOGS ENDPOINTS
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}3. Testing Logs Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create a log (using yesterday's date to avoid conflicts)
YESTERDAY=$(date -d "yesterday" -u +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || date -v-1d -u +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || echo "2024-12-15T00:00:00.000Z")
test_endpoint "POST /api/logs - Create log entry" \
    "POST" "/api/logs" \
    "{\"date\":\"$YESTERDAY\",\"newPages\":\"1-5\",\"newRating\":4,\"reviewPages\":\"10-15\",\"reviewRating\":5,\"notes\":\"Good memorization session\"}" \
    201

# Get all logs
test_endpoint "GET /api/logs - Get all logs" \
    "GET" "/api/logs" "" 200

# Get logs with pagination
test_endpoint "GET /api/logs?limit=10 - Get logs with pagination" \
    "GET" "/api/logs?limit=10&offset=0" "" 200

# Get statistics
test_endpoint "GET /api/logs/stats - Get user statistics" \
    "GET" "/api/logs/stats" "" 200

# Store log ID for update/delete tests
echo -e "${YELLOW}Getting log ID for update/delete tests...${NC}"
LOG_ID=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/logs" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['logs'][0]['_id'] if data.get('logs') else '')" 2>/dev/null)

if [ ! -z "$LOG_ID" ]; then
    echo -e "${GREEN}Log ID: $LOG_ID${NC}"
    echo ""

    # Get single log
    test_endpoint "GET /api/logs/$LOG_ID - Get single log" \
        "GET" "/api/logs/$LOG_ID" "" 200

    # Update log
    test_endpoint "PUT /api/logs/$LOG_ID - Update log" \
        "PUT" "/api/logs/$LOG_ID" \
        '{"newRating":5,"notes":"Updated notes - excellent session"}' \
        200

    # Verify update
    test_endpoint "GET /api/logs/$LOG_ID - Verify log update" \
        "GET" "/api/logs/$LOG_ID" "" 200
else
    echo -e "${RED}Could not get log ID for update/delete tests${NC}"
    echo ""
fi

# Create another log for testing (2 days ago to avoid conflicts)
TWO_DAYS_AGO=$(date -d "2 days ago" -u +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || date -v-2d -u +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || echo "2024-12-13T00:00:00.000Z")
test_endpoint "POST /api/logs - Create second log entry" \
    "POST" "/api/logs" \
    "{\"date\":\"$TWO_DAYS_AGO\",\"newPages\":\"6-10\",\"newRating\":3,\"notes\":\"Review session\"}" \
    201

##############################################
# 4. VALIDATION TESTS
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}4. Testing Input Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Invalid rating (should fail)
test_endpoint "POST /api/logs - Invalid rating (>5)" \
    "POST" "/api/logs" \
    '{"newPages":"1-5","newRating":10}' \
    400

# Invalid page format (should fail)
test_endpoint "POST /api/logs - Invalid page format (XSS attempt)" \
    "POST" "/api/logs" \
    '{"newPages":"<script>alert(1)</script>","newRating":4}' \
    400

# Missing required data (should fail)
test_endpoint "POST /api/logs - Missing required data" \
    "POST" "/api/logs" \
    '{"notes":"Only notes provided"}' \
    400

# Invalid Juz number (should fail)
test_endpoint "GET /api/juz/31 - Invalid Juz number (>30)" \
    "GET" "/api/juz/31" "" 400

# Invalid Juz pages (should fail)
test_endpoint "PUT /api/juz/1 - Invalid pages (>20)" \
    "PUT" "/api/juz/1" \
    '{"pages":25}' \
    400

##############################################
# 5. DUPLICATE PREVENTION TEST
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}5. Testing Duplicate Prevention${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Try to create duplicate log for today (should fail)
test_endpoint "POST /api/logs - Duplicate log for today (should fail)" \
    "POST" "/api/logs" \
    '{"newPages":"1-2","newRating":3}' \
    400

##############################################
# 6. DATE FILTERING TEST
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}6. Testing Date Filtering${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get logs with date range
test_endpoint "GET /api/logs?startDate=... - Date range filtering" \
    "GET" "/api/logs?startDate=2024-12-01&endDate=2024-12-31" "" 200

##############################################
# OPTIONAL: DELETE TESTS (Commented out to preserve data)
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}7. Delete Tests (Optional - Uncomment to run)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -z "$LOG_ID" ]; then
    echo -e "${YELLOW}To test delete operations, uncomment the lines below:${NC}"
    echo -e "${YELLOW}# test_endpoint \"DELETE /api/logs/\$LOG_ID - Delete log\" \\${NC}"
    echo -e "${YELLOW}#     \"DELETE\" \"/api/logs/\$LOG_ID\" \"\" 200${NC}"
    echo ""

    # Uncomment to test delete
    # test_endpoint "DELETE /api/logs/$LOG_ID - Delete log" \
    #     "DELETE" "/api/logs/$LOG_ID" "" 200
fi

# Delete user (DANGER - this will delete all user data)
# echo -e "${RED}WARNING: User deletion will remove ALL data!${NC}"
# echo -e "${YELLOW}# test_endpoint \"DELETE /api/user - Delete user account\" \\${NC}"
# echo -e "${YELLOW}#     \"DELETE\" \"/api/user\" \"\" 200${NC}"
# echo ""

##############################################
# TEST SUMMARY
##############################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${BLUE}Total:  $((PASS + FAIL))${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
