# 🔐 SentinelAI — Enterprise File Security with Real-Time Alerts

A full-stack security platform featuring **end-to-end AES-256 encryption**, **real-time owner notifications on access**, **device fingerprinting**, and **automated security alerts**.

## 🎯 Key Features

✅ **Real-Time Owner Alerts** — Instant notifications when access keys are used  
✅ **Device Fingerprinting** — Email verification only on new device logins (not every login)  
✅ **AES-256 File Encryption** — Client & server-side encryption for data at rest  
✅ **Encrypted Access Keys** — Share files securely with time-limited access  
✅ **Behavioral Monitoring** — AI-driven anomaly detection (simulated)  
✅ **Multi-Factor Authentication** — 2FA with OTP + security codes  
✅ **Mailgun Email Integration** — Automated security notifications  

## 🏗️ Architecture

```
Frontend (React + Vite)
├── Client-side AES-256 encryption (crypto-js)
├── Real-time notifications (CustomEvent dispatch)
├── Multi-factor auth UI
└── Dashboard with file management

↓ API (Express + JWT)

Backend (Node.js + Express)
├── MongoDB database
├── Server-side AES-256 encryption
├── JWT authentication
├── Mailgun email service
└── RESTful API endpoints

Database (MongoDB)
├── Users (encrypted passwords)
├── Files (encrypted content)
└── Access logs
```

## 🚀 Local Deployment

### Prerequisites
```bash
Node.js 18+
MongoDB (local or MongoDB Atlas)
Mailgun account (free tier available)
```

### 1. Frontend Setup
```bash
cd sentinel-demo
npm install
npm run dev
# Open http://localhost:3001/
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file:
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sentinel-ai
JWT_SECRET=change-this-to-secure-key
ENCRYPTION_SECRET=change-this-to-secure-key
PORT=5000
MAILGUN_API_KEY=key-xxxxxxxxxxxx
MAILGUN_DOMAIN=mg.sentinel-ai.com

npm start
# Backend runs on http://localhost:5000/
```

### 3. Test Email Integration
```bash
# Create Mailgun account at mailgun.com
# Add your domain and API key to .env
# Test endpoint: POST http://localhost:5000/api/auth/login
```

## 🌐 Vercel Deployment (Frontend Only)

```bash
npm install -g vercel
vercel
# Follow prompts to deploy frontend
```

**Frontend deployed to Vercel:** [your-deploy-url]

## 🔧 Backend Deployment (Render.com — Free Tier)

```bash
# 1. Push code to GitHub
git push

# 2. Connect to Render.com
# - Go to render.com
# - Click "New +" → "Web Service"
# - Connect your GitHub repo
# - Set Environment:
#    - Root Directory: backend
#    - Build Command: npm install
#    - Start Command: npm start

# 3. Add secrets (Environment Variables):
MONGODB_URI=your-mongodb-connection
JWT_SECRET=secure-random-key
ENCRYPTION_SECRET=secure-random-key
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=your-mailgun-domain
```

## 📝 Demo Walkthrough

### 1. **Sign Up**
```
Email: test@example.com
Password: SecurePass123!
→ Generates 8 security backup codes
→ Generates 3 access keys (for demo file)
→ Welcome email sent
```

### 2. **Login from New Device**
```
First login: No email (demo device)
Second login (different browser): 
→ Device fingerprint generated
→ AUTOMATED EMAIL to user inbox ✓
"New Device Login Detected — Your account was accessed from..."
```

### 3. **Simulate Access Key Use**
```
Sidebar → "Simulate Key Use"
→ Select access key
→ Owner receives REAL-TIME POPUP
→ Popup shows: Revoke | Allow | Mark Safe
→ AUTOMATED EMAIL to owner inbox
"Access Key Used on [file]"
```

### 4. **Encryption Verification**
```
Upload file → Encrypted with AES-256 on client & server
Download file → Decrypted automatically
API responses show encrypted content (gibberish)
```

## 🔑 API Endpoints

### Auth
```
POST /api/auth/signup
POST /api/auth/login
```

### Files
```
POST /api/files/upload (encrypted)
GET /api/files (list)
GET /api/files/:fileId (retrieve & decrypt)
```

### Access Keys
```
POST /api/files/:fileId/access-keys (create)
POST /api/access-keys/use (use key + notify owner)
```

## 🎓 What Makes This Production-Ready

1. **Real Encryption** — AES-256 with crypto-js (client) + CryptoJS (server)
2. **Secure Auth** — JWT tokens + bcrypt password hashing
3. **Email Notifications** — Mailgun API for reliable delivery
4. **Device Tracking** — Browser fingerprinting prevents spam alerts
5. **Error Handling** — Graceful fallbacks for email failures
6. **Environment Config** — Secrets in .env (never in code)
7. **Scalable DB** — MongoDB supports millions of users

## 🏆 Hackathon Highlights

✨ **Full-Stack Security** — Frontend + Backend + Database  
✨ **Real Email Delivery** — Mailgun integration (not simulated)  
✨ **Production Deployment** — Vercel + Render  
✨ **Real Encryption** — AES-256 at rest  
✨ **Device Fingerprinting** — Smart device tracking  
✨ **Real-Time Notifications** — WebSocket-ready architecture  

## 📊 Demo Credentials

```
Email: demo@sentinel.ai
Password: demo123
```

## 🐛 Troubleshooting

### Email not sending?
```
See if MAILGUN_API_KEY is set:
node -e "console.log(process.env.MAILGUN_API_KEY)"

Check Mailgun dashboard for failed deliveries:
https://app.mailgun.com/app/logs
```

### MongoDB connection error?
```
Verify connection string format:
mongodb+srv://user:password@cluster.mongodb.net/database

Check IP whitelist on MongoDB Atlas
```

## 📚 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Crypto-JS |
| Backend | Express 4, Node.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Email | Mailgun API |
| Encryption | AES-256 (CryptoJS) |
| Deployment | Vercel + Render |

## 🎯 Roadmap

- [ ] WebSocket real-time notifications (before Mailgun email)
- [ ] Role-based access control (RBAC)
- [ ] Activity audit logs with server-side filtering
- [ ] Advanced AI behavioral monitoring
- [ ] Mobile app (React Native)

## 📄 License

MIT

---

**Built for AMD Slingshot Hackathon 2026**

Questions? Check the `/backend` and `/src` folders for implementation details.
