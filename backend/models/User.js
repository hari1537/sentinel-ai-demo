import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true }, // hashed
  org: String,
  accessKeys: [{
    id: String,
    key: String,
    fileId: String,
    usesRemaining: Number,
    createdAt: Date
  }],
  securityCodes: [{
    code: String,
    used: Boolean
  }],
  registeredDevices: [{
    fingerprint: String,
    device: String,
    ip: String,
    location: String,
    registeredAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
