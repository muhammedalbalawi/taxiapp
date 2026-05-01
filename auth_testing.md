# Auth-Gated App Testing Playbook (Emergent Google Auth)

Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'user_' + Date.now().toString(16);
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  role: 'customer',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

Step 2: Test Backend API
```bash
curl -X GET "https://luxury-rides-59.preview.emergentagent.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

Step 3: Browser Testing
Set cookie "session_token" and navigate to app URL. Verify dashboard loads without redirect.

Success Indicators
- /api/auth/me returns user data
- Dashboard loads without redirect
- CRUD operations work
