import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';
import User from './models/User.js';
import File from './models/File.js';
import { encryptData, decryptData, hashData } from './middleware/encryption.js';
import { newDeviceLoginEmail, accessKeyUsedEmail } from './middleware/emailService.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sentinel-ai';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('✗ MongoDB connection failed:', err.message));

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Auth Routes ───────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, name, password, org } = req.body;
    
    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    // Generate security codes
    const securityCodes = Array.from({ length: 8 }, () => ({
      code: Array.from({ length: 12 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join(''),
      used: false
    }));
    
    // Create user
    const user = await User.create({
      email,
      name,
      password: hashedPassword,
      org,
      securityCodes,
      accessKeys: []
    });
    
    // Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user: { id: user._id, email, name, org },
      securityCodes: securityCodes.map(s => ({ code: s.code })),
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, deviceFingerprint } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcryptjs.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Check if this is a new device
    const isNewDevice = !user.registeredDevices?.some(d => d.fingerprint === deviceFingerprint);
    
    if (isNewDevice && email !== 'demo@sentinel.ai') {
      // Send device notification email
      const device = req.body.device || 'Unknown Device';
      const ip = req.body.ip || req.ip;
      const location = req.body.location || 'Unknown Location';
      
      user.registeredDevices = user.registeredDevices || [];
      user.registeredDevices.push({
        fingerprint: deviceFingerprint,
        device,
        ip,
        location,
        registeredAt: new Date()
      });
      await user.save();
      
      // Send email asynchronously
      newDeviceLoginEmail(email, device, ip, location, new Date().toLocaleString()).catch(err => 
        console.error('Email send failed:', err)
      );
    }
    
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      user: { id: user._id, email: user.email, name: user.name, org: user.org },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── File Routes ───────────────────────────────────────────────────────────
app.post('/api/files/upload', auth, async (req, res) => {
  try {
    const { name, content, description, tags } = req.body;
    
    // Encrypt file content
    const encryptedContent = encryptData(content);
    const hash = hashData(content);
    
    const file = await File.create({
      userId: req.userId,
      name,
      description,
      encryptedContent,
      hash,
      size: content.length,
      tags: tags || []
    });
    
    res.json({ file: { id: file._id, name: file.name, createdAt: file.createdAt } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:fileId', auth, async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.userId.toString() !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    
    // Decrypt content
    const decryptedContent = decryptData(file.encryptedContent, true);
    
    res.json({
      file: {
        id: file._id,
        name: file.name,
        content: decryptedContent,
        createdAt: file.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files', auth, async (req, res) => {
  try {
    const files = await File.find({ userId: req.userId }).select('_id name description size createdAt tags');
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Access Key Routes ─────────────────────────────────────────────────────
app.post('/api/files/:fileId/access-keys', auth, async (req, res) => {
  try {
    const { uses = 3 } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const key = 'KEY-' + Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');
    
    user.accessKeys = user.accessKeys || [];
    user.accessKeys.push({
      id: Date.now().toString(),
      key,
      fileId: req.params.fileId,
      usesRemaining: uses,
      createdAt: new Date()
    });
    
    await user.save();
    
    res.json({ key, usesRemaining: uses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/access-keys/use', async (req, res) => {
  try {
    const { key, externalUser } = req.body;
    
    const user = await User.findOne({ 'accessKeys.key': key });
    if (!user) return res.status(401).json({ error: 'Invalid access key' });
    
    const accessKey = user.accessKeys.find(k => k.key === key);
    if (!accessKey || accessKey.usesRemaining <= 0) {
      return res.status(403).json({ error: 'Access key expired or invalid' });
    }
    
    // Decrement uses
    accessKey.usesRemaining -= 1;
    await user.save();
    
    // Send notification email to file owner
    const file = await File.findById(accessKey.fileId);
    if (file && file.userId) {
      const owner = await User.findById(file.userId);
      if (owner) {
        accessKeyUsedEmail(owner.email, file.name, externalUser || 'External User', {
          key: key.substring(0, 8) + '...',
          usesRemaining: accessKey.usesRemaining
        }).catch(err => console.error('Email send failed:', err));
      }
    }
    
    // Return encrypted file content
    if (file) {
      const decryptedContent = decryptData(file.encryptedContent, true);
      return res.json({ file: { name: file.name, content: decryptedContent } });
    }
    
    res.status(404).json({ error: 'File not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SentinelAI Backend running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${MONGODB_URI}`);
  console.log(`🔑 Encryption enabled with CryptoJS`);
  console.log(`📧 Mailgun integration: ${process.env.MAILGUN_API_KEY ? '✓ Configured' : '⚠ Simulation mode'}`);
});
