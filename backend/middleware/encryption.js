import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.ENCRYPTION_SECRET || 'sentinel-ai-default-key-change-in-production';

export const encryptData = (data) => {
  try {
    return CryptoJS.AES.encrypt(
      typeof data === 'string' ? data : JSON.stringify(data),
      SECRET_KEY
    ).toString();
  } catch (err) {
    console.error('Encryption error:', err);
    throw err;
  }
};

export const decryptData = (encryptedData, returnString = false) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return returnString ? decrypted : JSON.parse(decrypted);
  } catch (err) {
    console.error('Decryption error:', err);
    throw err;
  }
};

export const hashData = (data) => {
  return CryptoJS.SHA256(typeof data === 'string' ? data : JSON.stringify(data)).toString();
};
