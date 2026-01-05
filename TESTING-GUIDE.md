# 🚀 ORYNO WEBAPP - ACCESS & TESTING GUIDE

## ✅ SERVICES RUNNING

### Backend API
- **URL:** http://localhost:8002
- **API Endpoints:** http://localhost:8002/api
- **API Docs:** http://localhost:8002/docs (FastAPI Swagger UI)
- **Status:** ✅ RUNNING

### Frontend (WebApp)
- **URL:** http://localhost:5174
- **Status:** ✅ RUNNING (Vite Dev Server)

### Database
- **MongoDB:** localhost:27017
- **Database:** oryno_webapp
- **Status:** ✅ RUNNING

---

## 🌐 HOW TO ACCESS THE WEBAPP

### Option 1: Preview Link (Recommended)
Your Emergent workspace should have a **Preview** button or link. Use this to access:
- Frontend: Port 5174
- Backend API Docs: Port 8002

### Option 2: Direct URLs (if port forwarding is set up)
- WebApp: `http://localhost:5174`
- API Docs: `http://localhost:8002/docs`

---

## 🧪 HOW TO RUN TESTS

### 1. Backend API Tests (Terminal)

```bash
# Navigate to backend
cd /app/webapp-backend

# Run the comprehensive test
python final_test.py
```

**This tests:**
- ✅ User Registration
- ✅ User Login (Customer & Operator)
- ✅ Service Creation
- ✅ Order Creation
- ✅ Analytics

**Expected Result:** All 11 tests should PASS ✅

---

### 2. API Documentation Testing (Browser)

**Access:** http://localhost:8002/docs

You'll see the **FastAPI Swagger UI** where you can:

1. **Try Authentication:**
   - Click on `/api/auth/register`
   - Click "Try it out"
   - Fill in:
     ```json
     {
       "email": "mytest@example.com",
       "password": "Test123",
       "full_name": "My Name",
       "role": "customer"
     }
     ```
   - Click "Execute"

2. **Login:**
   - Go to `/api/auth/login`
   - Use your email and password
   - Copy the `access_token` from the response

3. **Authorize:**
   - Click the green "Authorize" button at the top
   - Paste your token in the format: `Bearer YOUR_TOKEN_HERE`
   - Click "Authorize"

4. **Test Protected Endpoints:**
   - Try `/api/services` - List services
   - Try `/api/orders` - Create/list orders
   - Try `/api/analytics/dashboard` - View analytics

---

### 3. Frontend Testing (Browser)

**Access:** http://localhost:5174

The webapp should load with the original Base44 interface, but now it's using your NEW backend API!

**Test Flow:**
1. Navigate through the pages
2. Check browser console for any errors (F12 → Console)
3. Try to register/login (if auth pages exist)

**Note:** Some features may not work yet as we're transitioning from Base44 to the new API.

---

## 🛠️ TESTING WITH CURL

### Quick API Tests:

```bash
# Health Check
curl http://localhost:8002/health

# Register User
curl -X POST http://localhost:8002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","full_name":"Test User","role":"customer"}'

# Login
curl -X POST http://localhost:8002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verified_user@example.com","password":"Test123"}'

# Get Services (requires token)
curl -X GET http://localhost:8002/api/services \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📊 TEST DATA AVAILABLE

We created test data during testing:

### Users (can login with password: "Test123"):
- `customer1766200829@example.com` (Role: customer)
- `operator1766200829@example.com` (Role: operator)

### Services:
- Grand Hotel NYC ($250/night)

### Orders:
- Order #ORD-20251220-3E6E2CA4 ($275)

---

## 🔍 CHECKING LOGS

### Backend Logs:
```bash
# Real-time logs
tail -f /var/log/supervisor/webapp-backend.err.log

# Last 50 lines
tail -50 /var/log/supervisor/webapp-backend.err.log
```

### Frontend Logs:
```bash
# Development server logs
tail -f /tmp/webapp-dev.log
```

### MongoDB:
```bash
# Connect to MongoDB
mongosh oryno_webapp

# List all users
db.users.find().pretty()

# List all services
db.services.find().pretty()

# List all orders
db.orders.find().pretty()
```

---

## 🎯 WHAT TO TEST

### Priority 1: Core Features
- [x] User Registration
- [x] User Login
- [x] Service Listing
- [x] Order Creation
- [x] Analytics Dashboard

### Priority 2: Additional Features
- [ ] 2FA Setup
- [ ] File Upload
- [ ] Hotel Management
- [ ] Restaurant Management
- [ ] Payment Processing

### Priority 3: Frontend Integration
- [ ] Login page with new API
- [ ] Service browsing
- [ ] Order creation flow
- [ ] User dashboard

---

## 📝 TEST SCENARIOS

### Scenario 1: New User Registration Flow
1. Open webapp: http://localhost:5174
2. Navigate to registration page
3. Fill in details
4. Submit (email will be mocked - check logs)
5. User is created in database

### Scenario 2: Operator Creates Service
1. Login as operator (use API or create via MongoDB)
2. Navigate to service creation
3. Fill in service details
4. Submit
5. Service appears in listings

### Scenario 3: Customer Creates Order
1. Login as customer
2. Browse services
3. Select a service
4. Create booking/order
5. View order in "My Orders"

---

## 🚨 TROUBLESHOOTING

### Frontend doesn't load?
```bash
# Check if it's running
ps aux | grep vite

# Restart it
cd /app/webapp
yarn dev
```

### Backend API not responding?
```bash
# Check status
sudo supervisorctl status webapp-backend

# Restart
sudo supervisorctl restart webapp-backend

# Check logs
tail -50 /var/log/supervisor/webapp-backend.err.log
```

### Can't connect to MongoDB?
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Test connection
mongosh --eval "db.version()"
```

---

## 🎉 QUICK START

**Fastest way to see everything working:**

1. **Open API Documentation:**
   - Go to: http://localhost:8002/docs
   - Test endpoints directly in browser

2. **Run Integration Test:**
   ```bash
   cd /app/webapp-backend
   python final_test.py
   ```
   - Should show: ✅ All tests PASSED

3. **Access Frontend:**
   - Go to: http://localhost:5174
   - See the webapp interface

---

## 📞 PORTS REFERENCE

| Service | Port | URL |
|---------|------|-----|
| WebApp Frontend | 5174 | http://localhost:5174 |
| Backend API | 8002 | http://localhost:8002/api |
| API Docs | 8002 | http://localhost:8002/docs |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Original Backend | 8001 | http://localhost:8001/api |

---

## ✅ VERIFICATION CHECKLIST

- [x] Backend running on port 8002
- [x] Frontend running on port 5174
- [x] MongoDB running on port 27017
- [x] Test data created
- [x] All API tests passing (100%)
- [x] API documentation accessible
- [x] Mock email service working
- [x] Local file storage working

---

**Everything is ready for testing! 🚀**

**Start here:** http://localhost:8002/docs (API Documentation)
**Or here:** http://localhost:5174 (WebApp)
