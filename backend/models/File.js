import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  encryptedContent: { type: String, required: true }, // AES-256 encrypted
  size: Number,
  mimeType: String,
  hash: String, // for integrity verification
  accessLevel: { type: String, enum: ['private', 'shared', 'public'], default: 'private' },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  scanResults: {
    malwareDetected: Boolean,
    riskScore: Number,
    lastScanned: Date
  }
});

export default mongoose.model('File', fileSchema);
