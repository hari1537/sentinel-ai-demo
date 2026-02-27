import { useState, useEffect, useRef, useCallback } from "react";
import emailjs from '@emailjs/browser';
import CryptoJS from 'crypto-js';

// ─── Encryption Utilities (AES-256) ────────────────────────────────────────
const ENCRYPTION_SECRET = 'sentinel-ai-aes-256-key-' + Date.now().toString().slice(-6);
const CryptoEngine = {
  encrypt(data) {
    try {
      return CryptoJS.AES.encrypt(
        typeof data === 'string' ? data : JSON.stringify(data),
        ENCRYPTION_SECRET
      ).toString();
    } catch (err) { console.error('Encrypt error:', err); return null; }
  },
  decrypt(encrypted) {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_SECRET);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted.startsWith('{') ? JSON.parse(decrypted) : decrypted;
    } catch (err) { console.error('Decrypt error:', err); return null; }
  },
  hash(data) {
    return CryptoJS.SHA256(typeof data === 'string' ? data : JSON.stringify(data)).toString();
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const randEl = (arr) => arr[Math.floor(Math.random() * arr.length)];
const genOTP = () => String(rand(100000, 999999));
const genIP = () => `${rand(1,255)}.${rand(0,255)}.${rand(0,255)}.${rand(0,255)}`;
const genDevice = () => randEl(["Chrome 121 / Windows 11","Firefox 122 / macOS Sonoma","Safari 17 / iPhone 15 Pro","Edge 121 / Windows 10","Chrome Mobile / Android 14"]);
const genLocation = () => randEl(["Moscow, Russia","Beijing, China","Lagos, Nigeria","São Paulo, Brazil","Mumbai, India","Hanoi, Vietnam","Pyongyang, DPRK"]);
const ts = () => new Date().toLocaleString();
const fmtT = (d) => new Date(d).toLocaleTimeString();
const fmtDT = (d) => new Date(d).toLocaleString();
const hexStr = (n) => Array.from({length:n},()=>"0123456789ABCDEF"[rand(0,15)]).join("");
const genCodes = () => Array.from({length:8},()=>`${hexStr(4)}-${hexStr(4)}-${hexStr(4)}`);

// ─── Device Tracker (stable fingerprinting per browser) ──────────────────
const DeviceTracker = {
  // Generate a stable browser fingerprint (consistent across page reloads)
  generateFingerprint() {
    const nav = navigator;
    const screen_res = `${window.screen.width}x${window.screen.height}`;
    const ua = nav.userAgent.substring(0, 50); // consistent user agent
    const lang = nav.language;
    const tz = new Date().getTimezoneOffset();
    // Simple hash: concatenate fingerprint components
    // In real app, use FingerprintJS or similar
    return `fp_${ua}_${screen_res}_${lang}_${tz}`.replace(/[\s\/]/g, '_');
  },
  isNewDevice(userId) {
    const devices = JSON.parse(localStorage.getItem("sentinel_devices")||"[]");
    const fp = DeviceTracker.generateFingerprint();
    const key = `${userId}-${fp}`;
    return !devices.find(d => d.key === key);
  },
  register(userId) {
    const devices = JSON.parse(localStorage.getItem("sentinel_devices")||"[]");
    const fp = DeviceTracker.generateFingerprint();
    const key = `${userId}-${fp}`;
    if(!devices.find(d => d.key === key)) {
      const device = genDevice();
      const ip = genIP();
      const loc = genLocation();
      devices.unshift({key, userId, device, ip, loc, fingerprint: fp, registered: Date.now()});
      localStorage.setItem("sentinel_devices", JSON.stringify(devices));
      return {isNew: true, device, ip, loc};
    }
    return {isNew: false};
  }
};

// ─── Email Engine (simulated — stores in localStorage, displays in-app) ─────
const EmailEngine = {
  send(to, subject, body, type="security") {
    const emails = JSON.parse(localStorage.getItem("sentinel_emails")||"[]");
    const msg = { id: Date.now()+rand(0,999), to, subject, body, type, time: Date.now(), read: false };
    emails.unshift(msg);
    localStorage.setItem("sentinel_emails", JSON.stringify(emails.slice(0,50)));
    // Attempt to send real email via EmailJS if configured
    try{
      const publicKey = localStorage.getItem('emailjs_public_key');
      const serviceId = 'service_dl5mmsr';
      const templateId = 'template_dead8ln';
      if(publicKey){
        const templateParams = {
          to_email: to,
          subject,
          body_html: body,
          timestamp: new Date().toLocaleString()
        };
        emailjs.send(serviceId, templateId, templateParams, publicKey).then(()=>{
          console.log('EmailJS: message sent to', to);
        },(err)=>{console.warn('EmailJS error', err);});
      }
    }catch(e){console.warn('Email send failed',e);}    
    return msg;
  },
  getAll(email) {
    const emails = JSON.parse(localStorage.getItem("sentinel_emails")||"[]");
    return emails.filter(e=>e.to===email);
  },
  markRead(id) {
    const emails = JSON.parse(localStorage.getItem("sentinel_emails")||"[]");
    const idx = emails.findIndex(e=>e.id===id);
    if(idx!==-1){ emails[idx].read=true; localStorage.setItem("sentinel_emails",JSON.stringify(emails)); }
  },
  unreadCount(email) {
    return EmailEngine.getAll(email).filter(e=>!e.read).length;
  }
};

// ─── Email Templates ──────────────────────────────────────────────────────
const Emails = {
  loginOTP(email, otp, ip, device) {
    return EmailEngine.send(email, "🔐 Your SentinelAI Login Code", `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,255,170,.2)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(0,255,170,.1);padding-bottom:16px">Intelligent Data Security Guardian</div>
  <h2 style="color:#c8e6de;margin-bottom:8px">Your Authentication Code</h2>
  <p style="color:#4a7a6a;margin-bottom:20px">A login attempt was made to your SentinelAI account. Use the code below to complete verification.</p>
  <div style="background:rgba(0,255,170,.08);border:1px solid rgba(0,255,170,.3);border-radius:8px;padding:20px;text-align:center;margin-bottom:20px">
    <div style="font-size:2.2rem;letter-spacing:12px;color:#00ffaa;font-weight:bold">${otp}</div>
    <div style="color:#4a7a6a;font-size:.8rem;margin-top:8px">Valid for 10 minutes • Do not share</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <tr><td style="color:#4a7a6a;padding:6px 0">IP Address</td><td style="color:#00ffaa;text-align:right">${ip}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Device</td><td style="color:#00ffaa;text-align:right">${device}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Time</td><td style="color:#00ffaa;text-align:right">${ts()}</td></tr>
  </table>
  <p style="color:#4a7a6a;font-size:.75rem;margin-top:20px;border-top:1px solid rgba(0,255,170,.1);padding-top:16px">If you did not attempt to log in, your account may be compromised. Contact security immediately.</p>
</div>`, "otp");
  },
  suspiciousLogin(email, ip, device, loc) {
    return EmailEngine.send(email, "🚨 Suspicious Login Attempt — Action Required", `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(255,34,68,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(255,34,68,.2);padding-bottom:16px">Security Alert System</div>
  <div style="background:rgba(255,34,68,.1);border:1px solid rgba(255,34,68,.4);border-radius:8px;padding:16px;margin-bottom:20px">
    <div style="color:#ff4466;font-size:1rem;font-weight:bold">⚠ UNAUTHORIZED ACCESS ATTEMPT</div>
    <div style="color:#ff8899;font-size:.85rem;margin-top:4px">New login detected from unrecognized device & location</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:20px">
    <tr><td style="color:#4a7a6a;padding:6px 0">Time</td><td style="color:#ff4466;text-align:right">${ts()}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">IP Address</td><td style="color:#ff4466;text-align:right">${ip}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Device</td><td style="color:#ff4466;text-align:right">${device}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Location</td><td style="color:#ff4466;text-align:right">${loc}</td></tr>
  </table>
  <p style="color:#c8e6de;font-size:.85rem">If this was <strong style="color:#ff4466">not you</strong>, immediately change your password and revoke all active sessions from the Security Dashboard.</p>
  <p style="color:#4a7a6a;font-size:.75rem;margin-top:16px">SentinelAI Security Team • Automated Alert</p>
</div>`, "alert");
  },
  behaviorAlert(email, desc, riskLevel) {
    return EmailEngine.send(email, "⚠ Behavioral Anomaly Detected in Your Session", `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(255,204,0,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(255,204,0,.2);padding-bottom:16px">AI Behavioral Monitoring Engine</div>
  <div style="background:rgba(255,204,0,.08);border:1px solid rgba(255,204,0,.3);border-radius:8px;padding:16px;margin-bottom:20px">
    <div style="color:#ffcc00;font-weight:bold">AI ANOMALY DETECTED</div>
    <div style="color:#ffdd66;font-size:.85rem;margin-top:4px">${desc}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:20px">
    <tr><td style="color:#4a7a6a;padding:6px 0">Risk Level</td><td style="color:#ffcc00;text-align:right;font-weight:bold">${riskLevel}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Detected At</td><td style="color:#ffcc00;text-align:right">${ts()}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Action</td><td style="color:#ffcc00;text-align:right">Session flagged for review</td></tr>
  </table>
  <p style="color:#4a7a6a;font-size:.75rem;border-top:1px solid rgba(255,204,0,.1);padding-top:12px">SentinelAI Behavioral AI • Automated Report</p>
</div>`, "behavior");
  },
  passwordReset(email, tempPass) {
    return EmailEngine.send(email, "🔑 Your Password Reset Code — SentinelAI", `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,136,255,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(0,136,255,.2);padding-bottom:16px">Account Recovery System</div>
  <h2 style="color:#c8e6de;margin-bottom:8px">Password Reset Requested</h2>
  <p style="color:#4a7a6a;margin-bottom:20px">A password reset was requested for your SentinelAI account. Use the temporary code below.</p>
  <div style="background:rgba(0,136,255,.1);border:1px solid rgba(0,136,255,.4);border-radius:8px;padding:20px;text-align:center;margin-bottom:20px">
    <div style="font-size:1.8rem;letter-spacing:8px;color:#0088ff;font-weight:bold">${tempPass}</div>
    <div style="color:#4a7a6a;font-size:.8rem;margin-top:8px">Use as your temporary password</div>
  </div>
  <p style="color:#c8e6de;font-size:.85rem">Enter this code as your password on the login page, then update your password in Settings.</p>
  <p style="color:#4a7a6a;font-size:.75rem;margin-top:16px">If you did not request this, ignore this message.</p>
</div>`, "reset");
  },
  fileUploaded(email, filename, size) {
    return EmailEngine.send(email, `📁 File Secured: ${filename}`, `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,255,170,.2)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(0,255,170,.1);padding-bottom:16px">Secure File Storage System</div>
  <div style="background:rgba(0,255,170,.06);border:1px solid rgba(0,255,170,.2);border-radius:8px;padding:16px;margin-bottom:20px">
    <div style="color:#00ffaa;font-weight:bold">✓ FILE SUCCESSFULLY SECURED</div>
    <div style="color:#c8e6de;font-size:.9rem;margin-top:4px">${filename}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <tr><td style="color:#4a7a6a;padding:6px 0">File Name</td><td style="color:#00ffaa;text-align:right">${filename}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Size</td><td style="color:#00ffaa;text-align:right">${size}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Encryption</td><td style="color:#00ffaa;text-align:right">AES-256-GCM</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Uploaded At</td><td style="color:#00ffaa;text-align:right">${ts()}</td></tr>
  </table>
  <p style="color:#4a7a6a;font-size:.75rem;margin-top:16px">SentinelAI Storage Vault • Automated Confirmation</p>
</div>`, "file");
  },
  welcomeEmail(name, email) {
    return EmailEngine.send(email, `👋 Welcome to SentinelAI, ${name}!`, `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,255,170,.2)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(0,255,170,.1);padding-bottom:16px">Intelligent Data Security Guardian</div>
  <h2 style="color:#00ffaa;margin-bottom:8px">Account Successfully Created</h2>
  <p style="color:#c8e6de;margin-bottom:16px">Welcome aboard, <strong style="color:#00ffaa">${name}</strong>. Your SentinelAI security account is active and protecting your data.</p>
  <ul style="color:#4a7a6a;padding-left:20px;line-height:2">
    <li>Multi-layer authentication enabled</li>
    <li>AI behavioral monitoring active</li>
    <li>8 security backup codes generated</li>
    <li>AES-256 encrypted file storage ready</li>
  </ul>
  <p style="color:#4a7a6a;font-size:.75rem;margin-top:20px;border-top:1px solid rgba(0,255,170,.1);padding-top:12px">SentinelAI Security Platform • ${ts()}</p>
</div>`, "welcome");
  },
  newDeviceLogin(email, device, ip, loc, time) {
    return EmailEngine.send(email, "🔐 New Device Login to Your Account", `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,136,255,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="color:#4a7a6a;font-size:.75rem;margin-bottom:24px;border-bottom:1px solid rgba(0,136,255,.2);padding-bottom:16px">Device Verification System</div>
  <div style="background:rgba(0,136,255,.08);border:1px solid rgba(0,136,255,.3);border-radius:8px;padding:14px 16px;margin-bottom:20px">
    <div style="color:#0088ff;font-size:1rem;font-weight:bold">ℹ NEW DEVICE LOGIN DETECTED</div>
    <div style="color:#88ccff;font-size:.85rem;margin-top:4px">Your account was accessed from an unrecognized device.</div>
  </div>
  <div style="background:rgba(2,11,18,.6);border:1px solid rgba(0,136,255,.2);border-radius:8px;padding:16px;margin-bottom:20px;font-size:.84rem;">
    <div style="color:#00ffaa;font-weight:bold;margin-bottom:8px">Login Details:</div>
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
      <tr><td style="color:#4a7a6a;padding:6px 0">Device</td><td style="color:#88ccff;text-align:right">${device}</td></tr>
      <tr><td style="color:#4a7a6a;padding:6px 0">IP Address</td><td style="color:#88ccff;text-align:right">${ip}</td></tr>
      <tr><td style="color:#4a7a6a;padding:6px 0">Location</td><td style="color:#88ccff;text-align:right">${loc}</td></tr>
      <tr><td style="color:#4a7a6a;padding:6px 0">Time</td><td style="color:#88ccff;text-align:right">${time}</td></tr>
    </table>
  </div>
  <p style="color:#c8e6de;font-size:.85rem;margin-bottom:12px"><strong>Did you just log in?</strong></p>
  <ul style="color:#4a7a6a;font-size:.82rem;padding-left:20px;line-height:1.8;margin-bottom:16px">
    <li>✓ If <strong style="color:#00ffaa">YES</strong>, your login will continue after verification steps.</li>
    <li>✗ If <strong style="color:#ff2244">NO</strong>, your account may be compromised. Change your password immediately.</li>
  </ul>
  <p style="color:#4a7a6a;font-size:.75rem;border-top:1px solid rgba(0,136,255,.1);padding-top:12px">SentinelAI Device Verification • Automated Alert</p>
</div>`, "device");
  }
};

// ─── Access Key Engine (simulated storage & events) ──────────────────────
const AccessKeyEngine = {
  generate(ownerId, fileId, uses = 3) {
    const keys = JSON.parse(localStorage.getItem("sentinel_keys")||"[]");
    const key = `${hexStr(4)}-${hexStr(4)}-${hexStr(4)}`;
    const obj = { id: Date.now()+rand(0,999), key, ownerId, fileId, usesRemaining: uses };
    keys.unshift(obj);
    localStorage.setItem("sentinel_keys", JSON.stringify(keys));
    return obj;
  },
  getByKey(key) {
    const keys = JSON.parse(localStorage.getItem("sentinel_keys")||"[]");
    return keys.find(k=>k.key===key);
  },
  useKey(key, externalUserName="External User"){
    const keys = JSON.parse(localStorage.getItem("sentinel_keys")||"[]");
    const idx = keys.findIndex(k=>k.key===key);
    if(idx===-1) return {ok:false,msg:"Invalid key"};
    const k = keys[idx];
    if(k.usesRemaining<=0) return {ok:false,msg:"Key exhausted"};
    k.usesRemaining -= 1;
    keys[idx]=k; localStorage.setItem("sentinel_keys",JSON.stringify(keys));

    // create event
    const ev = { id: Date.now()+rand(0,999), key:k.key, fileId:k.fileId, fileName:(MOCK_FILES.find(f=>f.id===k.fileId)||{}).name||"Unknown", ownerId:k.ownerId, time:Date.now(), ip:genIP(), device:genDevice(), loc:genLocation(), remaining:k.usesRemaining, externalUser:externalUserName, status:"Allowed" };
    const evs = JSON.parse(localStorage.getItem("sentinel_key_events")||"[]"); evs.unshift(ev); localStorage.setItem("sentinel_key_events",JSON.stringify(evs));

    // dispatch window event for real-time UI
    try{ window.dispatchEvent(new CustomEvent('sentinel:keyUsed',{detail:ev})); }catch(e){}

    // send owner email
    const owner = (JSON.parse(localStorage.getItem("sentinel_users")||"[]")).find(u=>u.id===k.ownerId);
    if(owner) EmailEngine.send(owner.email, "Your secure access key was just used", `Key ${k.key} used to access ${ev.fileName} at ${fmtDT(ev.time)} from ${ev.ip} (${ev.device}, ${ev.loc}). Remaining uses: ${k.usesRemaining}`);

    return {ok:true,event:ev};
  },
  revoke(key){
    const keys = JSON.parse(localStorage.getItem("sentinel_keys")||"[]");
    const idx = keys.findIndex(k=>k.key===key); if(idx===-1) return false; keys[idx].usesRemaining=0; localStorage.setItem("sentinel_keys",JSON.stringify(keys)); return true;
  },
  list(){ return JSON.parse(localStorage.getItem("sentinel_keys")||"[]"); }
};

// ─── File Download Engine ────────────────────────────────────────────────
const FileEngine = {
  download(file) {
    // Generate realistic content based on file type
    let content = "", mime = "text/plain", ext = file.name.split(".").pop();
    if(ext==="xlsx"||ext==="csv") {
      content = `SentinelAI Secure Export\nFile: ${file.name}\nExported: ${ts()}\n\nDepartment,Q1,Q2,Q3,Q4\nEngineering,125000,138000,142000,155000\nMarketing,87000,91000,95000,102000\nSales,210000,225000,248000,271000\nOperations,68000,71000,74000,78000\nHR,45000,46000,47000,48000\n\nTotal Revenue,535000,571000,606000,654000\nGrowth Rate,6.7%,8.2%,5.3%,7.9%`;
      mime = "text/csv";
    } else if(ext==="json") {
      content = JSON.stringify({sentinelai:{version:"3.1",exported:ts(),classification:"CONFIDENTIAL"},server:{host:"sentinel-prod-01.internal",port:8443,ssl:true,timeout:30},database:{host:"db-cluster-01.internal",port:5432,name:"sentinel_vault",pool_size:20},security:{mfa_required:true,session_timeout:3600,encryption:"AES-256-GCM",key_rotation:"30d"}},null,2);
      mime = "application/json";
    } else if(ext==="pem"||ext==="key") {
      content = `-----BEGIN CERTIFICATE-----\nMIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\nTzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\ncmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n[SENTINEL_AI_ENCRYPTED_SECTION]\nExportedBy: SentinelAI Vault\nTimestamp: ${ts()}\n-----END CERTIFICATE-----`;
    } else if(ext==="md"||ext==="txt") {
      content = `# ${file.name}\n\nExported from SentinelAI Secure Vault\nDate: ${ts()}\nClassification: CONFIDENTIAL\n\n## Contents\n\nThis file was securely stored in the SentinelAI encrypted vault.\nAll data is protected with AES-256-GCM encryption.\n\n## Security Metadata\n- Encryption: AES-256-GCM\n- Hash: SHA-256\n- Access Level: Restricted\n- Audit Trail: Enabled`;
    } else {
      content = `SENTINELAI SECURE EXPORT\n${"=".repeat(50)}\nFile: ${file.name}\nSize: ${file.size}\nType: ${file.type||"document"}\nExported: ${ts()}\nProtection: AES-256-GCM Encrypted\n\nThis file was exported from SentinelAI Secure Vault.\nAll contents are classified and protected.\n\nExport ID: ${hexStr(8)}-${hexStr(4)}-${hexStr(4)}\nAudit Reference: SEN-${Date.now()}`;
    }
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  downloadReport(type, data) {
    let content = `SENTINELAI SECURITY REPORT\n${"=".repeat(60)}\nGenerated: ${ts()}\nReport Type: ${type}\n\n`;
    if(type==="Security Summary") {
      content += `THREAT OVERVIEW\n${"-".repeat(40)}\nCritical Alerts: ${data.critical||1}\nHigh Alerts: ${data.high||2}\nMedium Alerts: ${data.medium||3}\nLow Alerts: ${data.low||4}\n\nRisk Score: ${data.riskScore||35}/100\nSession Status: ${data.status||"Active"}\nMonitoring: AI Behavioral Engine v3.1\n\nRECOMMENDATIONS\n1. Enable hardware security key for 2FA\n2. Review trusted device list monthly\n3. Rotate security backup codes quarterly`;
    } else if(type==="Audit Log") {
      content += `AUDIT TRAIL\n${"-".repeat(40)}\n`;
      (data.events||[]).forEach((e,i)=>{ content+=`[${fmtDT(e.time)}] ${e.desc}\n`; });
    } else {
      content += JSON.stringify(data, null, 2);
    }
    const blob = new Blob([content], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`sentinel-${type.toLowerCase().replace(/\s/g,"-")}-${Date.now()}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
};

// ─── Mock Data ────────────────────────────────────────────────────────────
const MOCK_FILES = [
  {id:1,name:"Q4_Financial_Report.xlsx",size:"2.4 MB",type:"spreadsheet",protected:true,uploaded:Date.now()-86400000,content:"Financial data"},
  {id:2,name:"Employee_Database.csv",size:"8.1 MB",type:"database",protected:true,uploaded:Date.now()-172800000,content:"Employee records"},
  {id:3,name:"Server_Config.json",size:"14 KB",type:"config",protected:true,uploaded:Date.now()-3600000,content:"Config data"},
  {id:4,name:"Backup_Keys.pem",size:"4 KB",type:"key",protected:true,uploaded:Date.now()-7200000,content:"Key data"},
];
const MOCK_ALERTS = [
  {id:1,desc:"Brute force attempt from 91.213.88.12",severity:"Critical",time:Date.now()-300000,status:"Blocked"},
  {id:2,desc:"Unusual login pattern detected",severity:"High",time:Date.now()-900000,status:"Monitoring"},
  {id:3,desc:"Multiple failed 2FA attempts",severity:"Medium",time:Date.now()-1800000,status:"Resolved"},
  {id:4,desc:"Suspicious API requests detected",severity:"Low",time:Date.now()-3600000,status:"Resolved"},
];
const DEMO_CODES = ["A1B2-C3D4-E5F6","7G8H-9I0J-K1L2","M3N4-O5P6-Q7R8","S9T0-U1V2-W3X4","Y5Z6-A7B8-C9D0","E1F2-G3H4-I5J6","K7L8-M9N0-O1P2","Q3R4-S5T6-U7V8"];
const SEV_COLOR = {Critical:"#ff2244",High:"#ff6600",Medium:"#ffcc00",Low:"#00ff88"};
const NAV = [{id:"dashboard",icon:"⬡",label:"Dashboard"},{id:"monitoring",icon:"◎",label:"AI Monitoring"},{id:"files",icon:"◫",label:"File Storage"},{id:"alerts",icon:"△",label:"Alerts"},{id:"analytics",icon:"〜",label:"Analytics"},{id:"devices",icon:"⊡",label:"Devices"},{id:"inbox",icon:"✉",label:"Inbox"},{id:"settings",icon:"⊕",label:"Settings"}];

// ─── CSS ─────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;400;500;600;700&family=Exo+2:wght@300;400;600;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#020b12;--glass:rgba(0,255,170,.04);--gb:rgba(0,255,170,.15);--neon:#00ffaa;--blue:#0088ff;--red:#ff2244;--warn:#ffcc00;--text:#c8e6de;--muted:#4a7a6a;}
body{background:var(--bg);color:var(--text);font-family:'Exo 2',sans-serif;min-height:100vh;overflow-x:hidden;}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.1);opacity:1}}
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(0,255,170,.2)}50%{box-shadow:0 0 40px rgba(0,255,170,.5)}}
@keyframes codeReveal{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.fade-in{animation:fadeIn .4s ease both;}
.glass{background:var(--glass);border:1px solid var(--gb);border-radius:12px;backdrop-filter:blur(10px);}
.glass-dark{background:rgba(2,11,18,.88);border:1px solid var(--gb);border-radius:12px;backdrop-filter:blur(18px);}
.btn{padding:10px 22px;border-radius:8px;border:none;cursor:pointer;font-family:'Exo 2',sans-serif;font-weight:600;font-size:.88rem;transition:all .2s;letter-spacing:.5px;display:inline-flex;align-items:center;justify-content:center;gap:6px;}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;}
.btn-primary{background:linear-gradient(135deg,#00ffaa,#0088ff);color:#020b12;box-shadow:0 0 20px rgba(0,255,170,.25);}
.btn-primary:hover:not(:disabled){box-shadow:0 0 32px rgba(0,255,170,.5);transform:translateY(-1px);}
.btn-ghost{background:transparent;border:1px solid var(--gb);color:var(--text);}
.btn-ghost:hover{border-color:var(--neon);color:var(--neon);}
.btn-danger{background:rgba(255,34,68,.12);border:1px solid #ff2244;color:#ff2244;}
.btn-danger:hover{background:rgba(255,34,68,.25);}
.btn-warn{background:rgba(255,204,0,.12);border:1px solid #ffcc00;color:#ffcc00;}
.btn-warn:hover{background:rgba(255,204,0,.25);}
.btn-blue{background:rgba(0,136,255,.12);border:1px solid #0088ff;color:#0088ff;}
.btn-blue:hover{background:rgba(0,136,255,.25);}
.btn-success{background:rgba(0,255,170,.12);border:1px solid #00ffaa;color:#00ffaa;}
.btn-success:hover{background:rgba(0,255,170,.22);}
.input{width:100%;padding:12px 16px;background:rgba(0,255,170,.04);border:1px solid var(--gb);border-radius:8px;color:var(--text);font-family:'Exo 2',sans-serif;font-size:.93rem;outline:none;transition:all .2s;}
.input:focus{border-color:var(--neon);box-shadow:0 0 12px rgba(0,255,170,.12);}
.input::placeholder{color:var(--muted);}
.sidebar{width:240px;background:rgba(2,11,18,.97);border-right:1px solid var(--gb);height:100vh;position:fixed;left:0;top:0;flex-direction:column;padding:20px 0;z-index:100;display:flex;}
.main-content{margin-left:240px;padding:30px;min-height:100vh;}
.nav-item{display:flex;align-items:center;gap:11px;padding:11px 22px;color:var(--muted);cursor:pointer;transition:all .2s;font-size:.88rem;font-weight:500;letter-spacing:.4px;position:relative;}
.nav-item:hover,.nav-item.active{color:var(--neon);background:rgba(0,255,170,.05);}
.nav-item.active{border-left:2px solid var(--neon);}
.stat-card{position:relative;overflow:hidden;}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--neon),transparent);}
.tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:4px;font-size:.73rem;font-weight:600;letter-spacing:.5px;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;padding:10px 14px;color:var(--muted);font-size:.75rem;letter-spacing:1px;border-bottom:1px solid var(--gb);}
td{padding:11px 14px;border-bottom:1px solid rgba(0,255,170,.04);font-size:.85rem;}
.otp-input{width:50px;height:58px;text-align:center;font-size:1.5rem;font-family:'Share Tech Mono',monospace;background:rgba(0,255,170,.05);border:1px solid var(--gb);border-radius:8px;color:var(--neon);outline:none;transition:all .2s;}
.otp-input:focus{border-color:var(--neon);box-shadow:0 0 16px rgba(0,255,170,.3);}
.progress-bar{height:4px;background:rgba(0,255,170,.08);border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;border-radius:2px;transition:width .6s ease;}
.scrollbar::-webkit-scrollbar{width:4px;}
.scrollbar::-webkit-scrollbar-track{background:transparent;}
.scrollbar::-webkit-scrollbar-thumb{background:var(--gb);border-radius:2px;}
.sec-code{display:flex;align-items:center;padding:9px 13px;border-radius:7px;background:rgba(0,255,170,.04);border:1px solid rgba(0,255,170,.1);font-family:'Share Tech Mono',monospace;font-size:.86rem;color:var(--neon);letter-spacing:2px;animation:codeReveal .3s ease both;transition:all .2s;cursor:pointer;gap:8px;}
.sec-code:hover{background:rgba(0,255,170,.1);border-color:rgba(0,255,170,.3);}
.sec-code.used{color:var(--muted);text-decoration:line-through;background:rgba(0,0,0,.15);border-color:rgba(255,255,255,.04);cursor:default;}
.step-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0;background:rgba(0,255,170,.06);border:1px solid rgba(0,255,170,.15);color:var(--muted);transition:all .3s;}
.step-badge.active{background:linear-gradient(135deg,#00ffaa,#0088ff);border:none;color:#020b12;}
.step-badge.done{background:rgba(0,255,170,.12);border-color:var(--neon);color:var(--neon);}
.modal-overlay{position:fixed;inset:0;background:rgba(2,11,18,.85);backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;}
.modal{background:rgba(4,18,28,.97);border:1px solid var(--gb);border-radius:16px;max-width:540px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 0 60px rgba(0,255,170,.12);}
.modal-header{padding:24px 28px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.modal-body{padding:20px 28px 28px;}
.close-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--muted);width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;transition:all .2s;}
.close-btn:hover{border-color:var(--red);color:var(--red);}
.badge-dot{width:8px;height:8px;border-radius:50%;position:absolute;top:8px;right:10px;background:var(--red);box-shadow:0 0 6px var(--red);animation:blink 1.5s infinite;}
`;

// ─── Particle Canvas ──────────────────────────────────────────────────────
function ParticleCanvas() {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    let w = c.width=window.innerWidth, h = c.height=window.innerHeight;
    const pts = Array.from({length:70},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.4+.4}));
    let raf;
    const draw=()=>{
      ctx.clearRect(0,0,w,h);
      pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(0,255,170,.55)";ctx.fill();});
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(0,255,170,${.14*(1-d/110)})`;ctx.lineWidth=.5;ctx.stroke();}}
      raf=requestAnimationFrame(draw);
    };
    draw();
    const ro=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight;};
    window.addEventListener("resize",ro);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",ro);};
  },[]);
  return <canvas ref={ref} style={{position:"fixed",top:0,left:0,zIndex:0,pointerEvents:"none",opacity:.45}}/>;
}

function Shield({size=80,pulse=false}){
  return(
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {pulse&&<div style={{position:"absolute",width:size*1.7,height:size*1.7,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,255,170,.12) 0%,transparent 70%)",animation:"pulse 2s ease-in-out infinite"}}/>}
      <svg width={size} height={size} viewBox="0 0 80 80">
        <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00ffaa"/><stop offset="100%" stopColor="#0088ff"/></linearGradient></defs>
        <path d="M40 8 L68 20 L68 44 C68 58 55 70 40 74 C25 70 12 58 12 44 L12 20 Z" fill="none" stroke="url(#sg)" strokeWidth="2.5" filter="url(#glow)"/>
        <path d="M40 14 L62 24 L62 44 C62 55 52 65 40 69 C28 65 18 55 18 44 L18 24 Z" fill="rgba(0,255,170,.06)"/>
        <path d="M30 38 L37 45 L52 32" stroke="#00ffaa" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="cb"/><feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </svg>
    </div>
  );
}

function AuthLayout({children,title,subtitle,wide=false}){
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:20}}>
      <ParticleCanvas/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:wide?620:440}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
            <Shield size={42} pulse/>
            <div><div style={{fontSize:"1.5rem",fontWeight:800,letterSpacing:2,color:"var(--neon)",fontFamily:"'Rajdhani',sans-serif",textShadow:"0 0 18px rgba(0,255,170,.4)"}}>SENTINEL</div><div style={{fontSize:".6rem",letterSpacing:4,color:"var(--muted)",marginTop:-2}}>AI SECURITY</div></div>
          </div>
          <div style={{fontSize:"1.05rem",fontWeight:600,color:"var(--text)"}}>{title}</div>
          {subtitle&&<div style={{fontSize:".82rem",color:"var(--muted)",marginTop:3}}>{subtitle}</div>}
        </div>
        <div className="glass-dark" style={{padding:32}}>{children}</div>
        <div style={{textAlign:"center",marginTop:12,fontSize:".7rem",color:"var(--muted)"}}>Protected by SentinelAI • Enterprise Security Platform</div>
      </div>
    </div>
  );
}

function StepProgress({step}){
  const steps=["Login","Security Code","2FA Verify","Access"];
  return(
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",marginBottom:24}}>
      {steps.map((s,i)=>{
        const n=i+1,active=n===step,done=n<step;
        return(
          <div key={s} style={{display:"flex",alignItems:"center"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div className={`step-badge${active?" active":done?" done":""}`}>{done?"✓":n}</div>
              <span style={{fontSize:".58rem",color:active?"var(--neon)":done?"rgba(0,255,170,.5)":"var(--muted)",letterSpacing:.4,whiteSpace:"nowrap"}}>{s}</span>
            </div>
            {i<3&&<div style={{width:40,height:1,background:done?"rgba(0,255,170,.3)":"rgba(0,255,170,.07)",margin:"0 3px",marginBottom:16,transition:"background .4s"}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────
function Modal({title,icon,onClose,children,wide=false}){
  useEffect(()=>{const h=(e)=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[]);
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal fade-in" style={{maxWidth:wide?680:520}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {icon&&<span style={{fontSize:"1.4rem"}}>{icon}</span>}
            <div style={{fontSize:"1.05rem",fontWeight:700,color:"var(--text)"}}>{title}</div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function SimulateKeyModal({onClose}){
  const [key,setKey]=useState("");
  const [userName,setUserName]=useState("");
  const [result,setResult]=useState(null);
  const submit=()=>{
    const res=AccessKeyEngine.useKey(key.trim(), userName||"External User");
    setResult(res);
  };
  return(
    <Modal title="Simulate Key Use" icon="🔑" onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:".85rem",color:"var(--muted)"}}>Enter an encrypted access key to simulate external access.</div>
        <input className="input" placeholder="ACCESS-KEY-XXX" value={key} onChange={e=>setKey(e.target.value)} />
        <input className="input" placeholder="External user name (optional)" value={userName} onChange={e=>setUserName(e.target.value)} />
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-primary" onClick={submit}>SIMULATE ACCESS</button>
          <button className="btn btn-ghost" onClick={onClose}>CLOSE</button>
        </div>
        {result&&(
          <div style={{marginTop:8}}>
            {result.ok? <div style={{color:"var(--neon)"}}>Success — event recorded.</div> : <div style={{color:"var(--red)"}}>{result.msg}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RealTimeAlertPopup({ev,onClose,onRevoke,onMarkSafe,onAllow}){
  const severity = ev.remaining<=0?"Warning":"Info";
  useEffect(()=>{
    // subtle pulse sound via WebAudio
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type='sine'; o.frequency.value=520; g.gain.value=0.02; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{o.stop(); ctx.close();},220);
    }catch(e){}
  },[]);
  return(
    <div style={{position:"fixed",right:20,top:80,zIndex:1200,width:360}}>
      <div className="glass" style={{padding:16,borderLeft:`4px solid ${severity==="Warning"?"#ffcc00":"#00ffaa"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div><div style={{fontSize:"1.05rem",fontWeight:700}}>Secure Access Key Used</div><div style={{fontSize:".78rem",color:"var(--muted)"}}>{fmtDT(ev.time)}</div></div>
          <div style={{fontSize:".9rem",color:severity==="Warning"?"#ffcc00":"#00ffaa"}}>{severity}</div>
        </div>
        <div style={{fontSize:".86rem",color:"var(--text)",marginBottom:8}}>
          <div><strong>File:</strong> {ev.fileName}</div>
          <div><strong>By:</strong> {ev.externalUser}</div>
          <div><strong>From:</strong> {ev.ip} • {ev.device} • {ev.loc}</div>
          <div><strong>Remaining uses:</strong> {ev.remaining}</div>
          <div style={{marginTop:8,color:"var(--muted)"}}>Status: <strong style={{color:"var(--neon)"}}>{ev.status}</strong></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-danger" onClick={()=>onRevoke(ev.key)}>Revoke Key</button>
          <button className="btn btn-blue" onClick={()=>onAllow(ev)}>Allow</button>
          <button className="btn btn-ghost" onClick={()=>onMarkSafe(ev)}>Mark Safe</button>
        </div>
      </div>
    </div>
  );
}

function VerifyIdentityModal({user,onVerified,onClose}){
  const [step,setStep]=useState("password");
  const [pass,setPass]=useState("");
  const [otp]=useState(genOTP);
  const [otpInput,setOtpInput]=useState(["","","","","",""]);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const refs=useRef([]);

  useEffect(()=>{
    if(step==="otp"){
      const ip=genIP(),dev=genDevice();
      Emails.loginOTP(user.email,otp,ip,dev);
    }
  },[step]);

  const checkPass=()=>{
    setLoading(true);setErr("");
    setTimeout(()=>{
      setLoading(false);
      const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
      const u=users.find(x=>x.id===user.id);
      if((u&&u.password===pass)||(user.email==="demo@sentinel.ai"&&pass==="demo123")){setStep("otp");}
      else setErr("Incorrect password.");
    },700);
  };
  const verifyOtp=()=>{
    const entered=otpInput.join("");
    if(entered===otp){setStep("success");setTimeout(()=>{onVerified();onClose();},1400);}
    else setErr("Invalid code. Try again.");
  };
  const handleOtpChange=(i,v)=>{if(!/^\d?$/.test(v))return;const n=[...otpInput];n[i]=v;setOtpInput(n);if(v&&i<5)refs.current[i+1]?.focus();};
  const handleOtpKey=(i,e)=>{if(e.key==="Backspace"&&!otpInput[i]&&i>0)refs.current[i-1]?.focus();};

  return(
    <Modal title="Verify Your Identity" icon="🔐" onClose={onClose}>
      {step==="password"&&(
        <div>
          <p style={{color:"var(--muted)",fontSize:".86rem",marginBottom:20}}>Re-enter your password to confirm your identity before proceeding.</p>
          {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:12,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
          <label style={{fontSize:".76rem",color:"var(--muted)",letterSpacing:.5,display:"block",marginBottom:6}}>PASSWORD</label>
          <input className="input" type="password" placeholder="Enter your password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&checkPass()} style={{marginBottom:16}}/>
          <button className="btn btn-primary" onClick={checkPass} disabled={loading} style={{width:"100%",padding:"12px"}}>
            {loading?"VERIFYING...":"CONFIRM PASSWORD →"}
          </button>
        </div>
      )}
      {step==="otp"&&(
        <div>
          <div style={{background:"rgba(0,136,255,.07)",border:"1px solid rgba(0,136,255,.2)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:".82rem",color:"#88ccff"}}>
            📧 Verification code sent to <strong style={{color:"var(--neon)"}}>{user.email}</strong>. Check your <strong>Inbox</strong> tab.
          </div>
          <div style={{background:"rgba(0,255,170,.05)",border:"1px solid rgba(0,255,170,.15)",borderRadius:7,padding:"10px 14px",marginBottom:16,fontSize:".78rem",color:"var(--muted)"}}>
            Demo OTP: <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)",letterSpacing:3,fontSize:"1rem"}}>{otp}</span>
          </div>
          {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:12,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
          <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:20}}>
            {otpInput.map((v,i)=>(
              <input key={i} ref={el=>refs.current[i]=el} className="otp-input" maxLength={1} value={v}
                onChange={e=>handleOtpChange(i,e.target.value)} onKeyDown={e=>handleOtpKey(i,e)}/>
            ))}
          </div>
          <button className="btn btn-primary" onClick={verifyOtp} style={{width:"100%",padding:"12px"}}>VERIFY CODE →</button>
        </div>
      )}
      {step==="success"&&(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>✅</div>
          <div style={{color:"var(--neon)",fontWeight:700,fontSize:"1.1rem"}}>Identity Verified Successfully</div>
          <div style={{color:"var(--muted)",fontSize:".84rem",marginTop:6}}>Access granted. Returning...</div>
        </div>
      )}
    </Modal>
  );
}

function ForgotPasswordModal({onClose}){
  const [step,setStep]=useState("email");
  const [email,setEmail]=useState("");
  const [newPass,setNewPass]=useState("");
  const [confirm,setConfirm]=useState("");
  const [tempCode,setTempCode]=useState("");
  const [inputCode,setInputCode]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [generated,setGenerated]=useState("");

  const sendReset=()=>{
    setLoading(true);setErr("");
    setTimeout(()=>{
      setLoading(false);
      const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
      const u=users.find(x=>x.email===email);
      if(!u) return setErr("No account found with that email.");
      const code=hexStr(3)+"-"+hexStr(3);
      setTempCode(code); setGenerated(code);
      Emails.passwordReset(email,code);
      setStep("verify");
    },800);
  };

  const verifyCode=()=>{
    if(inputCode.toUpperCase()===tempCode.toUpperCase()) setStep("newpass");
    else setErr("Invalid reset code.");
  };

  const savePass=()=>{
    if(newPass.length<6) return setErr("Password must be at least 6 characters.");
    if(newPass!==confirm) return setErr("Passwords do not match.");
    setLoading(true);
    setTimeout(()=>{
      const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
      const idx=users.findIndex(u=>u.email===email);
      if(idx!==-1){users[idx].password=newPass;localStorage.setItem("sentinel_users",JSON.stringify(users));}
      setLoading(false); setStep("done");
    },700);
  };

  return(
    <Modal title="Reset Your Password" icon="🔑" onClose={onClose}>
      {step==="email"&&(
        <div>
          <p style={{color:"var(--muted)",fontSize:".86rem",marginBottom:20}}>Enter your registered email address. A reset code will be sent to your inbox.</p>
          {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:12,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
          <label style={{fontSize:".76rem",color:"var(--muted)",letterSpacing:.5,display:"block",marginBottom:6}}>EMAIL ADDRESS</label>
          <input className="input" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendReset()} style={{marginBottom:16}}/>
          <button className="btn btn-primary" onClick={sendReset} disabled={loading||!email} style={{width:"100%",padding:"12px"}}>
            {loading?"SENDING...":"SEND RESET CODE →"}
          </button>
        </div>
      )}
      {step==="verify"&&(
        <div>
          <div style={{background:"rgba(0,136,255,.07)",border:"1px solid rgba(0,136,255,.2)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:".82rem",color:"#88ccff"}}>
            📧 Reset code sent to <strong style={{color:"var(--neon)"}}>{email}</strong>. Check your Inbox tab after closing this modal.
          </div>
          <div style={{background:"rgba(0,255,170,.05)",border:"1px solid rgba(0,255,170,.15)",borderRadius:7,padding:"10px 14px",marginBottom:16,fontSize:".78rem",color:"var(--muted)"}}>
            Demo code: <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)",letterSpacing:2}}>{generated}</span>
          </div>
          {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:12,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
          <label style={{fontSize:".76rem",color:"var(--muted)",letterSpacing:.5,display:"block",marginBottom:6}}>ENTER RESET CODE</label>
          <input className="input" style={{fontFamily:"'Share Tech Mono',monospace",letterSpacing:3,textTransform:"uppercase",marginBottom:16}} placeholder="XXX-XXX" value={inputCode} onChange={e=>setInputCode(e.target.value.toUpperCase())}/>
          <button className="btn btn-primary" onClick={verifyCode} style={{width:"100%",padding:"12px"}}>VERIFY CODE →</button>
        </div>
      )}
      {step==="newpass"&&(
        <div>
          <p style={{color:"var(--muted)",fontSize:".86rem",marginBottom:20}}>Code verified. Set your new password below.</p>
          {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:12,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
          <label style={{fontSize:".76rem",color:"var(--muted)",display:"block",marginBottom:6}}>NEW PASSWORD</label>
          <input className="input" type="password" placeholder="Min 6 characters" value={newPass} onChange={e=>setNewPass(e.target.value)} style={{marginBottom:12}}/>
          <label style={{fontSize:".76rem",color:"var(--muted)",display:"block",marginBottom:6}}>CONFIRM PASSWORD</label>
          <input className="input" type="password" placeholder="Repeat new password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={{marginBottom:16}}/>
          <button className="btn btn-primary" onClick={savePass} disabled={loading} style={{width:"100%",padding:"12px"}}>
            {loading?"SAVING...":"UPDATE PASSWORD →"}
          </button>
        </div>
      )}
      {step==="done"&&(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>✅</div>
          <div style={{color:"var(--neon)",fontWeight:700,fontSize:"1.1rem"}}>Password Updated Successfully</div>
          <div style={{color:"var(--muted)",fontSize:".84rem",marginTop:6,marginBottom:20}}>You can now login with your new password.</div>
          <button className="btn btn-primary" onClick={onClose} style={{padding:"10px 32px"}}>GO TO LOGIN</button>
        </div>
      )}
    </Modal>
  );
}

function EmailViewModal({email:msg,onClose}){
  useEffect(()=>{ EmailEngine.markRead(msg.id); },[]);
  return(
    <Modal title={msg.subject} icon="📧" onClose={onClose} wide>
      <div style={{fontSize:".78rem",color:"var(--muted)",marginBottom:16,display:"flex",gap:20}}>
        <span>To: <span style={{color:"var(--neon)"}}>{msg.to}</span></span>
        <span>Received: <span style={{color:"var(--text)"}}>{fmtDT(msg.time)}</span></span>
      </div>
      <div dangerouslySetInnerHTML={{__html:msg.body}} style={{borderRadius:8,overflow:"hidden"}}/>
    </Modal>
  );
}

function AlertActionModal({alert:a,onAction,onClose}){
  const [done,setDone]=useState("");
  const act=(action)=>{
    setDone(action);
    onAction(a,action);
    setTimeout(onClose,1200);
  };
  return(
    <Modal title="Alert Response" icon={a.severity==="Critical"?"🚨":a.severity==="High"?"⚠":"ℹ"} onClose={onClose}>
      <div style={{background:`${SEV_COLOR[a.severity]}11`,border:`1px solid ${SEV_COLOR[a.severity]}44`,borderRadius:8,padding:"14px 16px",marginBottom:20}}>
        <div style={{color:SEV_COLOR[a.severity],fontWeight:700,marginBottom:4}}>{a.severity} Alert</div>
        <div style={{color:"var(--text)",fontSize:".88rem"}}>{a.desc}</div>
        <div style={{color:"var(--muted)",fontSize:".76rem",marginTop:6}}>{fmtDT(a.time||Date.now())}</div>
      </div>
      {done?(
        <div style={{textAlign:"center",padding:"12px 0",color:"var(--neon)",fontWeight:700}}>✓ Action applied: {done}</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button className="btn btn-success" onClick={()=>act("Allowed")} style={{justifyContent:"flex-start",padding:"12px 18px"}}>
            <span>✓</span><div style={{textAlign:"left"}}><div>Allow</div><div style={{fontSize:".75rem",fontWeight:400,opacity:.7}}>Permit this activity and mark as safe</div></div>
          </button>
          <button className="btn btn-warn" onClick={()=>act("Warned")} style={{justifyContent:"flex-start",padding:"12px 18px"}}>
            <span>⚠</span><div style={{textAlign:"left"}}><div>Issue Warning</div><div style={{fontSize:".75rem",fontWeight:400,opacity:.7}}>Log warning and continue monitoring</div></div>
          </button>
          <button className="btn btn-blue" onClick={()=>act("Identity Verification Requested")} style={{justifyContent:"flex-start",padding:"12px 18px"}}>
            <span>🔐</span><div style={{textAlign:"left"}}><div>Verify Identity</div><div style={{fontSize:".75rem",fontWeight:400,opacity:.7}}>Require user to re-authenticate</div></div>
          </button>
          <button className="btn btn-danger" onClick={()=>act("Session Blocked")} style={{justifyContent:"flex-start",padding:"12px 18px"}}>
            <span>🚫</span><div style={{textAlign:"left"}}><div>Block Session</div><div style={{fontSize:".75rem",fontWeight:400,opacity:.7}}>Immediately terminate and lock session</div></div>
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Sign Up ──────────────────────────────────────────────────────────────
function SignupPage({onSignup,onGoLogin}){
  const [form,setForm]=useState({name:"",email:"",password:"",confirm:"",org:""});
  const [err,setErr]=useState("");
  const [createdUser,setCreatedUser]=useState(null);
  const [copied,setCopied]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));

  const submit=()=>{
    if(!form.name||!form.email||!form.password) return setErr("Please fill all required fields.");
    if(form.password!==form.confirm) return setErr("Passwords do not match.");
    if(form.password.length<6) return setErr("Password must be at least 6 characters.");
    const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
    if(users.find(u=>u.email===form.email)) return setErr("Email already registered.");
    const codes=genCodes();
    const user={id:Date.now(),name:form.name,email:form.email,password:form.password,org:form.org,files:MOCK_FILES,alerts:MOCK_ALERTS,joined:Date.now(),securityCodes:codes.map(c=>({code:c,used:false}))};
    users.push(user); localStorage.setItem("sentinel_users",JSON.stringify(users));

    // generate access keys for the new user (client-side simulation)
    // create 3 access keys mapped to the first mock file with 3 uses each
    try{
      for(let i=0;i<3;i++){ AccessKeyEngine.generate(user.id, MOCK_FILES[0].id, 3); }
    }catch(e){}

    // fetch generated keys for display
    const aks = AccessKeyEngine.list().filter(k=>k.ownerId===user.id);
    user.accessKeys = aks;

    Emails.welcomeEmail(form.name,form.email);
    setCreatedUser(user);
  };

  const copyAll=()=>{ navigator.clipboard?.writeText(createdUser.securityCodes.map(c=>c.code).join("\n")); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  if(createdUser) return(
    <AuthLayout title="Save Your Security Codes" subtitle="Critical — store these in a safe location" wide>
      <div style={{background:"rgba(255,204,0,.07)",border:"1px solid rgba(255,204,0,.4)",borderRadius:8,padding:"14px 16px",marginBottom:18,display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:"1.2rem",flexShrink:0}}>⚠</span>
        <div style={{fontSize:".84rem",color:"#ffdd44"}}><strong>Each code is single-use and cannot be shown again.</strong> Store in a password manager or print them.</div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontSize:".73rem",color:"var(--muted)",letterSpacing:.8}}>YOUR 8 BACKUP SECURITY CODES</div><div style={{fontSize:".7rem",color:"var(--muted)",marginTop:2}}>Use any one when prompted after login</div></div>
        <button onClick={copyAll} style={{background:"rgba(0,255,170,.08)",border:"1px solid rgba(0,255,170,.2)",color:"var(--neon)",borderRadius:6,padding:"5px 14px",fontSize:".78rem",cursor:"pointer",fontWeight:600}}>{copied?"✓ COPIED":"COPY ALL"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:18}}>
        {createdUser.securityCodes.map((c,i)=>(
          <div key={i} className="sec-code" style={{animationDelay:`${i*30}ms`}} onClick={()=>navigator.clipboard?.writeText(c.code)}>
            <span style={{fontSize:".65rem",color:"var(--muted)",flexShrink:0,minWidth:16}}>{String(i+1).padStart(2,"0")}</span>
            <span style={{flex:1}}>{c.code}</span>
            <span style={{fontSize:".62rem",color:"var(--muted)"}}>⊕</span>
          </div>
        ))}
      </div>
      {createdUser.accessKeys&&createdUser.accessKeys.length>0&&(
        <div style={{marginBottom:18}}>
          <div style={{fontSize:".73rem",color:"var(--muted)",letterSpacing:.8,marginBottom:8}}>YOUR ACCESS KEYS (for protected files)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {createdUser.accessKeys.map((k,i)=> (
              <div key={k.id} className="sec-code" style={{animationDelay:`${i*30}ms`}} onClick={()=>navigator.clipboard?.writeText(k.key)}>
                <span style={{fontSize:".65rem",color:"var(--muted)",flexShrink:0,minWidth:16}}>{String(i+1).padStart(2,"0")}</span>
                <span style={{flex:1}}>{k.key} <span style={{fontSize:".68rem",color:"var(--muted)",marginLeft:8}}>({k.usesRemaining} uses)</span></span>
                <span style={{fontSize:".62rem",color:"var(--muted)"}}>⊕</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:".72rem",color:"var(--muted)",marginTop:8}}>Click any key to copy. These keys grant access to protected files — share only with trusted parties.</div>
        </div>
      )}
      <div style={{background:"rgba(0,136,255,.06)",border:"1px solid rgba(0,136,255,.15)",borderRadius:8,padding:"11px 14px",marginBottom:18,fontSize:".8rem",color:"#88bbff",lineHeight:1.5}}>
        ℹ A welcome email has been sent to <strong style={{color:"var(--neon)"}}>{createdUser.email}</strong>. You can view it in the Inbox after login.
      </div>
      <button className="btn btn-primary" onClick={onSignup} style={{width:"100%",padding:"13px",fontSize:"1rem"}}>✓ I'VE SAVED MY CODES — GO TO LOGIN</button>
    </AuthLayout>
  );

  return(
    <AuthLayout title="Create Your Account" subtitle="Secure file storage & AI-powered protection">
      {err&&<div style={{background:"rgba(255,34,68,.09)",border:"1px solid #ff2244",color:"#ff6677",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:".84rem",display:"flex",gap:8,alignItems:"center"}}><span>⚠</span>{err}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:13}}>
        <div><label style={{fontSize:".75rem",color:"var(--muted)",letterSpacing:.4,display:"block",marginBottom:5}}>FULL NAME *</label><input className="input" placeholder="John Doe" value={form.name} onChange={set("name")}/></div>
        <div><label style={{fontSize:".75rem",color:"var(--muted)",letterSpacing:.4,display:"block",marginBottom:5}}>EMAIL *</label><input className="input" type="email" placeholder="john@company.com" value={form.email} onChange={set("email")}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div><label style={{fontSize:".75rem",color:"var(--muted)",display:"block",marginBottom:5}}>PASSWORD *</label><input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set("password")}/></div>
          <div><label style={{fontSize:".75rem",color:"var(--muted)",display:"block",marginBottom:5}}>CONFIRM *</label><input className="input" type="password" placeholder="••••••••" value={form.confirm} onChange={set("confirm")}/></div>
        </div>
        <div><label style={{fontSize:".75rem",color:"var(--muted)",display:"block",marginBottom:5}}>ORGANIZATION</label><input className="input" placeholder="Acme Corp (optional)" value={form.org} onChange={set("org")}/></div>
        <button className="btn btn-primary" onClick={submit} style={{width:"100%",padding:"13px",fontSize:"1rem",marginTop:3}}>CREATE SECURE ACCOUNT →</button>
        <div style={{textAlign:"center",fontSize:".83rem",color:"var(--muted)"}}>Already have an account? <span style={{color:"var(--neon)",cursor:"pointer"}} onClick={onGoLogin}>Sign in</span></div>
      </div>
    </AuthLayout>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────
function LoginPage({onLogin,onGoSignup}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [showForgot,setShowForgot]=useState(false);

  const submit=()=>{
    setLoading(true);setErr("");
    setTimeout(()=>{
      const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
      const user=users.find(u=>u.email===email&&u.password===pass);
      setLoading(false);
      if(!user) return setErr("Invalid credentials. Please check your email and password.");
      
      // for non-demo users, send automatic device login notification email ONLY if new device
      if(user.email!=="demo@sentinel.ai"){
        const deviceInfo = DeviceTracker.register(user.id);
        if(deviceInfo.isNew){
          Emails.newDeviceLogin(user.email, deviceInfo.device, deviceInfo.ip, deviceInfo.loc, ts());
        }
      }
      
      onLogin(user);
    },800);
  };

  return(
    <>
    <AuthLayout title="Secure Authentication" subtitle="Multi-layer verification required">
      <StepProgress step={1}/>
      {err&&<div style={{background:"rgba(255,34,68,.09)",border:"1px solid #ff2244",color:"#ff6677",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:".84rem",display:"flex",gap:8}}><span>⚠</span>{err}</div>}
      {loading&&<div style={{background:"rgba(0,136,255,.08)",border:"1px solid rgba(0,136,255,.2)",color:"#88ccff",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:".84rem",display:"flex",gap:8}}><span>📧</span>Verifying credentials... A device verification email will be sent automatically.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:13}}>
        <div><label style={{fontSize:".75rem",color:"var(--muted)",display:"block",marginBottom:5}}>EMAIL ADDRESS</label><input className="input" type="email" placeholder="demo@sentinel.ai" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><label style={{fontSize:".75rem",color:"var(--muted)"}}>PASSWORD</label><span style={{fontSize:".75rem",color:"var(--neon)",cursor:"pointer"}} onClick={()=>setShowForgot(true)}>Forgot password?</span></div>
          <input className="input" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:"var(--muted)",fontSize:".82rem"}}><input type="checkbox" style={{accentColor:"var(--neon)"}}/>Remember this device</label>
        <button className="btn btn-primary" onClick={submit} disabled={loading} style={{width:"100%",padding:"13px",fontSize:"1rem"}}>{loading?"AUTHENTICATING...":"SIGN IN SECURELY →"}</button>
        <div style={{background:"rgba(0,255,170,.04)",border:"1px solid rgba(0,255,170,.09)",borderRadius:7,padding:"9px 13px",fontSize:".77rem",color:"var(--muted)"}}>
          Demo: <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)"}}>demo@sentinel.ai</span> / <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)"}}>demo123</span>
        </div>
        <div style={{textAlign:"center",fontSize:".83rem",color:"var(--muted)"}}>New here? <span style={{color:"var(--neon)",cursor:"pointer"}} onClick={onGoSignup}>Create account</span></div>
      </div>
    </AuthLayout>
    {showForgot&&<ForgotPasswordModal onClose={()=>setShowForgot(false)}/>}
    </>
  );
}

// ─── Security Code Page ───────────────────────────────────────────────────
function SecurityCodePage({user,onVerified,onBack}){
  const [input,setInput]=useState("");
  const [err,setErr]=useState("");
  const [attempts,setAttempts]=useState(0);
  const [loading,setLoading]=useState(false);
  const [showCodes,setShowCodes]=useState(false);
  const [copiedIdx,setCopiedIdx]=useState(null);

  const isDemo=user.email==="demo@sentinel.ai";
  const validCodes=user.securityCodes||DEMO_CODES.map(c=>({code:c,used:false}));
  const remaining=validCodes.filter(c=>(typeof c==="string"?true:!c.used)).length;
  const locked=attempts>=3;

  const copyCode=(code,idx)=>{ navigator.clipboard?.writeText(code); setCopiedIdx(idx); setTimeout(()=>setCopiedIdx(null),1500); };

  const verify=()=>{
    if(!input.trim()) return setErr("Please enter a security code.");
    setLoading(true);
    setTimeout(()=>{
      setLoading(false);
      const norm=input.trim().toUpperCase();
      const idx=validCodes.findIndex(c=>{const code=typeof c==="string"?c:c.code; const used=typeof c==="string"?false:c.used; return code===norm&&!used;});
      if(idx!==-1){
        const allUsers=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
        const uIdx=allUsers.findIndex(u=>u.id===user.id);
        if(uIdx!==-1&&allUsers[uIdx].securityCodes){allUsers[uIdx].securityCodes[idx].used=true;localStorage.setItem("sentinel_users",JSON.stringify(allUsers));}
        onVerified();
      } else {
        const na=attempts+1; setAttempts(na); setInput("");
        setErr(na>=3?"Account locked — too many failed attempts.":`Invalid code. ${3-na} attempt${3-na===1?"":"s"} remaining.`);
      }
    },600);
  };

  return(
    <AuthLayout title="Enter Security Code" subtitle="Use one of your 8 backup codes to continue" wide>
      <StepProgress step={2}/>
      <div style={{background:"rgba(0,136,255,.07)",border:"1px solid rgba(0,136,255,.22)",borderRadius:8,padding:"13px 16px",marginBottom:18,display:"flex",gap:10,alignItems:"flex-start",fontSize:".84rem",color:"#88ccff"}}>
        <span style={{fontSize:"1.1rem",flexShrink:0}}>🔑</span>
        <div>Enter one of your <strong>8 backup security codes</strong> from when you created your account. Each code is single-use.</div>
      </div>
      {err&&<div style={{background:"rgba(255,34,68,.09)",border:"1px solid #ff2244",color:"#ff6677",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:".84rem",display:"flex",gap:8}}><span>⚠</span>{err}</div>}
      <div style={{marginBottom:18}}>
        <label style={{fontSize:".75rem",color:"var(--muted)",letterSpacing:.4,display:"block",marginBottom:6}}>BACKUP SECURITY CODE</label>
        <input className="input" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:"1rem",letterSpacing:3,textTransform:"uppercase"}} placeholder="XXXX-XXXX-XXXX" value={input} onChange={e=>setInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&!locked&&verify()} disabled={locked} maxLength={14}/>
        <div style={{fontSize:".71rem",color:"var(--muted)",marginTop:5}}>Format: <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)"}}>XXXX-XXXX-XXXX</span></div>
      </div>
      <button className="btn btn-primary" onClick={verify} disabled={loading||locked} style={{width:"100%",padding:"12px",fontSize:"1rem",marginBottom:18}}>{loading?"VERIFYING...":"VERIFY SECURITY CODE →"}</button>
      <div style={{borderTop:"1px solid var(--gb)",paddingTop:14}}>
        <button onClick={()=>setShowCodes(s=>!s)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:".8rem",padding:0,marginBottom:showCodes?11:0}}>
          <span style={{display:"flex",alignItems:"center",gap:7}}><span style={{color:"var(--neon)"}}>{showCodes?"▾":"▸"}</span>{isDemo?`View demo codes`:`Your codes (${remaining} remaining)`}</span>
          {isDemo&&<span style={{background:"rgba(0,255,170,.08)",border:"1px solid rgba(0,255,170,.15)",color:"var(--neon)",borderRadius:4,padding:"1px 8px",fontSize:".68rem",fontWeight:600}}>DEMO</span>}
        </button>
        {showCodes&&(
          <div className="fade-in">
            {isDemo&&<div style={{background:"rgba(0,255,170,.03)",border:"1px solid rgba(0,255,170,.1)",borderRadius:7,padding:"8px 12px",marginBottom:9,fontSize:".76rem",color:"var(--muted)"}}>Click any code to auto-fill. Demo account codes shown below.</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {validCodes.map((c,i)=>{
                const code=typeof c==="string"?c:c.code;
                const used=typeof c==="string"?false:c.used;
                return(
                  <div key={i} className={`sec-code${used?" used":""}`} style={{animationDelay:`${i*25}ms`}} onClick={()=>{if(!used){setInput(code);setErr("");}copyCode(code,i);}}>
                    <span style={{fontSize:".64rem",color:"var(--muted)",flexShrink:0,minWidth:16}}>{String(i+1).padStart(2,"0")}</span>
                    <span style={{flex:1,fontSize:".82rem"}}>{code}</span>
                    {used?<span style={{fontSize:".62rem",color:"var(--muted)",flexShrink:0}}>USED</span>:<span style={{fontSize:".68rem",color:copiedIdx===i?"var(--neon)":"var(--muted)",flexShrink:0}}>{copiedIdx===i?"✓":"⊕"}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:".7rem",color:"var(--muted)",marginTop:7,textAlign:"center"}}>Click a code to auto-fill</div>
          </div>
        )}
      </div>
      <div style={{textAlign:"center",marginTop:14,fontSize:".79rem",color:"var(--muted)"}}><span style={{color:"var(--neon)",cursor:"pointer"}} onClick={onBack}>← Back to login</span></div>
    </AuthLayout>
  );
}

// ─── OTP Page ─────────────────────────────────────────────────────────────
function OTPPage({user,onVerified}){
  const ip=useRef(genIP()).current;
  const dev=useRef(genDevice()).current;
  const [otp]=useState(()=>{
    const code=genOTP();
    Emails.loginOTP(user.email,code,ip,dev);
    return code;
  });
  const [input,setInput]=useState(["","","","","",""]);
  const [err,setErr]=useState("");
  const refs=useRef([]);
  const handleChange=(i,v)=>{if(!/^\d?$/.test(v))return;const n=[...input];n[i]=v;setInput(n);if(v&&i<5)refs.current[i+1]?.focus();};
  const handleKey=(i,e)=>{if(e.key==="Backspace"&&!input[i]&&i>0)refs.current[i-1]?.focus();};
  const verify=()=>{if(input.join("")===otp)onVerified();else setErr("Invalid code. Try again.");};
  return(
    <AuthLayout title="Two-Factor Authentication" subtitle="Enter the 6-digit code from your email">
      <StepProgress step={3}/>
      <div style={{background:"rgba(0,136,255,.07)",border:"1px solid rgba(0,136,255,.22)",borderRadius:8,padding:"11px 14px",marginBottom:14,fontSize:".82rem",color:"#88ccff",display:"flex",gap:8,alignItems:"center"}}>
        <span>📧</span><div>Code sent to <strong style={{color:"var(--neon)"}}>{user.email}</strong> — check your Inbox tab after login</div>
      </div>
      <div style={{background:"rgba(0,255,170,.04)",border:"1px solid rgba(0,255,170,.13)",borderRadius:7,padding:"9px 13px",marginBottom:18,fontSize:".77rem",color:"var(--muted)"}}>
        Demo OTP: <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)",fontSize:"1.1rem",letterSpacing:4}}>{otp}</span>
      </div>
      {err&&<div style={{color:"var(--red)",fontSize:".84rem",marginBottom:11,padding:"8px 12px",background:"rgba(255,34,68,.08)",borderRadius:6}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:7,justifyContent:"center",marginBottom:22}}>
        {input.map((v,i)=><input key={i} ref={el=>refs.current[i]=el} className="otp-input" maxLength={1} value={v} onChange={e=>handleChange(i,e.target.value)} onKeyDown={e=>handleKey(i,e)}/>)}
      </div>
      <button className="btn btn-primary" onClick={verify} style={{width:"100%",padding:"12px",fontSize:"1rem"}}>VERIFY OTP CODE →</button>
      <div style={{textAlign:"center",marginTop:11,fontSize:".79rem",color:"var(--muted)"}}>Didn't receive? <span style={{color:"var(--neon)",cursor:"pointer"}} onClick={()=>{setErr("");alert(`Your OTP is: ${otp}`);}}>Show code again</span></div>
    </AuthLayout>
  );
}

// ─── Device Alert Page ────────────────────────────────────────────────────
function DeviceAlertPage({user,onApprove,onDeny}){
  const [ip]=useState(genIP);const [device]=useState(genDevice);const [loc]=useState(genLocation);const [time]=useState(ts);
  useEffect(()=>{ Emails.suspiciousLogin(user.email,ip,device,loc); },[]);
  return(
    <AuthLayout title="Suspicious Login Detected" subtitle="AI flagged this access attempt">
      <div style={{background:"rgba(255,34,68,.08)",border:"1px solid rgba(255,34,68,.4)",borderRadius:8,padding:"12px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:"1.4rem"}}>🚨</span><div style={{fontSize:".85rem",color:"#ff6677"}}>New login from unrecognized device & location. A security alert was sent to your email.</div>
      </div>
      <div className="glass" style={{padding:18,marginBottom:16}}>
        <div style={{fontSize:".68rem",color:"var(--muted)",letterSpacing:.8,marginBottom:11,borderBottom:"1px solid var(--gb)",paddingBottom:8}}>📬 AUTOMATED ALERT — sent to {user.email}</div>
        <div style={{fontWeight:600,marginBottom:11,fontSize:".9rem"}}>New login attempt on your SentinelAI account</div>
        {[["🕐 Time",time],["💻 Device",device],["🌐 IP",ip],["📍 Location",loc]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:".81rem",marginBottom:7}}>
            <span style={{color:"var(--muted)"}}>{l}</span><span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--neon)"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:9}}>
        <button className="btn btn-danger" onClick={onDeny} style={{flex:1}}>DENY</button>
        <button className="btn btn-blue" onClick={onApprove} style={{flex:1}}>TRUST DEVICE</button>
        <button className="btn btn-primary" onClick={onApprove} style={{flex:1}}>APPROVE</button>
      </div>
    </AuthLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function MiniBar({data,color="#00ffaa",h=60}){
  const max=Math.max(...data);
  return <div style={{display:"flex",alignItems:"flex-end",gap:3,height:h}}>{data.map((v,i)=><div key={i} style={{flex:1,height:`${(v/max)*100}%`,minHeight:2,background:`linear-gradient(to top,${color}88,${color}18)`,borderRadius:"2px 2px 0 0"}}/>)}</div>;
}
function RiskGauge({score}){
  const r=54,cx=64,cy=64,circ=2*Math.PI*r;
  const color=score>75?"#ff2244":score>50?"#ff6600":score>25?"#ffcc00":"#00ffaa";
  return(
    <div style={{position:"relative",width:128,height:128,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={128} height={128} style={{position:"absolute"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,255,170,.08)" strokeWidth={8}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{filter:`drop-shadow(0 0 6px ${color})`,transition:"stroke-dashoffset .6s ease"}}/>
      </svg>
      <div style={{textAlign:"center"}}><div style={{fontSize:"1.5rem",fontWeight:800,color,fontFamily:"'Share Tech Mono',monospace"}}>{score}</div><div style={{fontSize:".62rem",color:"var(--muted)",letterSpacing:1}}>RISK</div></div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({active,onNav,user,onLogout,unreadEmails,onSimulateOpen}){
  return(
    <div className="sidebar">
      <div style={{padding:"0 20px 18px",borderBottom:"1px solid var(--gb)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}><Shield size={30}/><div><div style={{fontSize:".95rem",fontWeight:700,color:"var(--neon)",letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>SENTINEL</div><div style={{fontSize:".58rem",color:"var(--muted)",letterSpacing:3}}>AI SECURITY</div></div></div>
      </div>
      <div style={{flex:1,padding:"10px 0",overflowY:"auto"}} className="scrollbar">
        {NAV.map(n=>(
          <div key={n.id} className={`nav-item${active===n.id?" active":""}`} onClick={()=>onNav(n.id)}>
            <span style={{fontSize:".95rem",width:18,textAlign:"center"}}>{n.icon}</span>
            <span>{n.label}</span>
            {n.id==="inbox"&&unreadEmails>0&&<div className="badge-dot"/>}
          </div>
        ))}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid var(--gb)"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#00ffaa,#0088ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",fontWeight:700,color:"#020b12",flexShrink:0}}>{user.name[0]}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:".82rem",fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:".68rem",color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div></div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button className="btn btn-ghost" onClick={onSimulateOpen} style={{flex:1,fontSize:".74rem",padding:"7px"}}>Simulate Key Use</button>
        </div>
        <button className="btn btn-ghost" onClick={onLogout} style={{width:"100%",fontSize:".78rem",padding:"7px"}}>Sign Out</button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
function DashboardPage({user,riskScore,sessionAlerts,behaviorStatus,onVerifyIdentity}){
  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div><h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:3}}>Security Dashboard</h1><div style={{color:"var(--muted)",fontSize:".85rem",fontFamily:"'Share Tech Mono',monospace"}}>{ts()}</div></div>
        <div className="glass" style={{padding:"7px 14px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"var(--neon)",boxShadow:"0 0 8px var(--neon)",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:".78rem",color:"var(--neon)"}}>AI MONITORING ACTIVE</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        {[
          {label:"RISK SCORE",val:riskScore,sub:"System threat level",color:riskScore>75?"#ff2244":riskScore>50?"#ff6600":riskScore>25?"#ffcc00":"#00ffaa"},
          {label:"ACTIVE ALERTS",val:sessionAlerts.length+(user.alerts?.length||0),sub:"Requires attention",color:"#ff6600"},
          {label:"PROTECTED FILES",val:user.files?.length||4,sub:"Encrypted & secured",color:"#00ffaa"},
          {label:"SESSION STATUS",val:behaviorStatus==="suspicious"?"RISKY":"SECURE",sub:behaviorStatus==="suspicious"?"Anomaly detected":"Normal patterns",color:behaviorStatus==="suspicious"?"#ff2244":"#00ffaa"},
        ].map(s=>(
          <div key={s.label} className="glass stat-card" style={{padding:"18px 20px"}}>
            <div style={{fontSize:".68rem",color:"var(--muted)",letterSpacing:.8,marginBottom:7}}>{s.label}</div>
            <div style={{fontSize:"1.9rem",fontWeight:800,color:s.color,fontFamily:"'Share Tech Mono',monospace"}}>{s.val}</div>
            <div style={{fontSize:".72rem",color:"var(--muted)",marginTop:3}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="glass" style={{padding:22}}>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:14}}>OVERALL RISK ASSESSMENT</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <RiskGauge score={riskScore}/>
            <div style={{flex:1}}>
              {[["Authentication","Secure",100,"#00ffaa"],["Behavior",behaviorStatus==="suspicious"?"Anomaly":"Normal",behaviorStatus==="suspicious"?35:88,behaviorStatus==="suspicious"?"#ff2244":"#00ffaa"],["Device Trust",riskScore>50?"Unverified":"Verified",riskScore>50?38:90,riskScore>50?"#ffcc00":"#00ffaa"],["Data Integrity","Intact",95,"#0088ff"]].map(([l,v,p,c])=>(
                <div key={l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".78rem",marginBottom:3}}><span style={{color:"var(--muted)"}}>{l}</span><span style={{color:c}}>{v}</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${p}%`,background:c}}/></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="glass" style={{padding:22}}>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:12}}>LOGIN ACTIVITY (12H)</div>
          <MiniBar data={[12,8,15,22,18,30,25,19,28,35,24,16]} h={72}/>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginTop:14,marginBottom:8}}>RISK TREND</div>
          <MiniBar data={[20,25,18,40,35,28,45,38,30,52,42,35]} color="#ff6600" h={44}/>
        </div>
      </div>
      <div className="glass" style={{padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8}}>RECENT SECURITY ALERTS</div>
          <button className="btn btn-blue" style={{fontSize:".74rem",padding:"5px 12px"}} onClick={onVerifyIdentity}>🔐 Verify Identity</button>
        </div>
        <table>
          <thead><tr><th>ALERT</th><th>SEVERITY</th><th>TIME</th><th>STATUS</th></tr></thead>
          <tbody>
            {[...sessionAlerts,...(user.alerts||[])].slice(0,5).map((a,i)=>(
              <tr key={i}>
                <td style={{color:"var(--text)"}}>{a.desc}</td>
                <td><span className="tag" style={{background:`${SEV_COLOR[a.severity]}18`,color:SEV_COLOR[a.severity],border:`1px solid ${SEV_COLOR[a.severity]}33`}}>{a.severity}</span></td>
                <td style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--muted)",fontSize:".78rem"}}>{fmtT(a.time||Date.now())}</td>
                <td style={{color:"var(--neon)",fontSize:".82rem"}}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AI Monitoring ────────────────────────────────────────────────────────
function MonitoringPage({events,behaviorStatus,riskScore,onVerifyIdentity}){
  return(
    <div className="fade-in">
      <h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:6}}>AI Behavioral Monitoring</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:".87rem"}}>Real-time session analysis powered by SentinelAI neural engine v3.1</p>
      {behaviorStatus==="suspicious"&&(
        <div style={{background:"rgba(255,34,68,.09)",border:"1px solid #ff2244",borderRadius:8,padding:"13px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:"1.1rem",animation:"blink 1s infinite"}}>🚨</span>
          <div style={{flex:1,fontSize:".85rem",color:"#ff6677"}}><strong>Anomalous behavior detected</strong> — AI engine flagged unusual patterns in this session.</div>
          <button className="btn btn-blue" style={{fontSize:".76rem",padding:"6px 12px",flexShrink:0}} onClick={onVerifyIdentity}>Verify Identity</button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[
          {metric:"Mouse Movement",value:"Normal",score:91,icon:"⊕"},
          {metric:"Click Frequency",value:"Normal",score:87,icon:"◎"},
          {metric:"Navigation Speed",value:riskScore>60?"Elevated":"Normal",score:riskScore>60?43:80,icon:"⬡"},
          {metric:"Session Duration",value:"Active",score:94,icon:"△"},
          {metric:"Idle Periods",value:"2 detected",score:70,icon:"◫"},
          {metric:"Data Access Rate",value:"Normal",score:83,icon:"〜"},
        ].map(m=>{
          const c=m.score>80?"#00ffaa":m.score>60?"#ffcc00":"#ff2244";
          return(
            <div key={m.metric} className="glass" style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{color:"var(--muted)",fontSize:"1rem"}}>{m.icon}</span>
                <span style={{fontSize:"1.3rem",fontWeight:800,color:c,fontFamily:"'Share Tech Mono',monospace"}}>{m.score}%</span>
              </div>
              <div style={{fontSize:".83rem",fontWeight:600,marginBottom:3}}>{m.metric}</div>
              <div style={{fontSize:".74rem",color:c,marginBottom:9}}>{m.value}</div>
              <div className="progress-bar"><div className="progress-fill" style={{width:`${m.score}%`,background:c}}/></div>
            </div>
          );
        })}
      </div>
      <div className="glass" style={{padding:22}}>
        <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:14}}>REAL-TIME EVENT LOG</div>
        <div style={{maxHeight:300,overflowY:"auto"}} className="scrollbar">
          {events.length===0&&<div style={{color:"var(--muted)",textAlign:"center",padding:24,fontSize:".85rem"}}>Interact with the app to generate behavioral events.</div>}
          {events.map((ev,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 0",borderBottom:"1px solid rgba(0,255,170,.04)"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:ev.suspicious?"#ff2244":"var(--neon)",flexShrink:0}}/>
              <span style={{fontFamily:"'Share Tech Mono',monospace",color:"var(--muted)",fontSize:".72rem",flexShrink:0}}>{fmtT(ev.time)}</span>
              <span style={{fontSize:".83rem",color:ev.suspicious?"#ff6677":"var(--text)",flex:1}}>{ev.desc}</span>
              {ev.suspicious&&<span className="tag" style={{background:"rgba(255,34,68,.09)",color:"#ff2244",border:"1px solid #ff224433",fontSize:".68rem",flexShrink:0}}>ANOMALY</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── File Storage ─────────────────────────────────────────────────────────
function FilesPage({user,onUpload,onDeleteFile}){
  const [drag,setDrag]=useState(false);
  const [toast,setToast]=useState("");
  const ICONS={spreadsheet:"⊟",database:"⊞",config:"⊙",key:"⊛",default:"⊡"};

  const showToast=(msg)=>{ setToast(msg); setTimeout(()=>setToast(""),2800); };

  const handleDrop=e=>{ e.preventDefault();setDrag(false); const f=e.dataTransfer.files[0]; if(f)onUpload(f.name,f.size,f); };

  const handleDownload=(f)=>{
    FileEngine.download(f);
    showToast(`Downloading: ${f.name}`);
  };

  return(
    <div className="fade-in">
      <h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:6}}>Secure File Storage</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:".87rem"}}>All files encrypted with AES-256-GCM. Protected and monitored by SentinelAI.</p>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,background:"rgba(0,255,170,.9)",color:"#020b12",padding:"12px 20px",borderRadius:8,fontWeight:600,fontSize:".85rem",zIndex:999,animation:"fadeIn .3s ease"}}>✓ {toast}</div>}
      <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={handleDrop}
        className="glass" style={{border:`2px dashed ${drag?"var(--neon)":"rgba(0,255,170,.15)"}`,borderRadius:12,padding:36,textAlign:"center",marginBottom:22,transition:"all .2s",background:drag?"rgba(0,255,170,.05)":""}}>
        <div style={{fontSize:"2rem",marginBottom:10}}>⊕</div>
        <div style={{fontWeight:600,marginBottom:4}}>Drop files to upload securely</div>
        <div style={{color:"var(--muted)",fontSize:".83rem",marginBottom:14}}>or click to browse — all files are encrypted on upload</div>
        <label className="btn btn-primary" style={{cursor:"pointer",display:"inline-flex"}}>
          <input type="file" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){const f=e.target.files[0];onUpload(f.name,f.size,f);}e.target.value="";}}/>
          SELECT FILES TO UPLOAD
        </label>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:14}}>
        {(user.files||MOCK_FILES).map(f=>(
          <div key={f.id} className="glass stat-card" style={{padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
              <span style={{fontSize:"1.7rem",color:"var(--neon)"}}>{ICONS[f.type]||ICONS.default}</span>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span className="tag" style={{background:"rgba(0,255,170,.09)",color:"var(--neon)",border:"1px solid rgba(0,255,170,.2)"}}>🔒 ENCRYPTED</span>
                <span style={{fontSize:".69rem",color:"var(--muted)"}}>{f.size}</span>
              </div>
            </div>
            <div style={{fontWeight:600,fontSize:".88rem",marginBottom:3,wordBreak:"break-all"}}>{f.name}</div>
            <div style={{fontSize:".72rem",color:"var(--muted)",marginBottom:13}}>{new Date(f.uploaded).toLocaleDateString()} • AES-256-GCM</div>
            <div style={{display:"flex",gap:7}}>
              <button className="btn btn-success" style={{flex:1,fontSize:".74rem",padding:"7px 4px"}} onClick={()=>handleDownload(f)}>⬇ Download</button>
              <button className="btn btn-danger" style={{flex:1,fontSize:".74rem",padding:"7px 4px"}} onClick={()=>{if(window.confirm(`Delete "${f.name}"?`))onDeleteFile(f.id);}}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>
      {(user.files||[]).length===0&&<div style={{textAlign:"center",padding:48,color:"var(--muted)"}}>No files uploaded yet. Upload a file to get started.</div>}
    </div>
  );
}

// ─── Alerts Page ──────────────────────────────────────────────────────────
function AlertsPage({alerts,sessionAlerts,onAction,user,riskScore,behaviorEvents}){
  const [selectedAlert,setSelectedAlert]=useState(null);
  const [statuses,setStatuses]=useState({});
  const all=[...sessionAlerts,...alerts];

  const handleAction=(a,action)=>{
    const key=`${a.desc}-${a.time}`;
    setStatuses(s=>({...s,[key]:action}));
    onAction(a,action);
  };

  const exportReport=()=>FileEngine.downloadReport("Security Summary",{critical:all.filter(x=>x.severity==="Critical").length,high:all.filter(x=>x.severity==="High").length,medium:all.filter(x=>x.severity==="Medium").length,low:all.filter(x=>x.severity==="Low").length,riskScore,status:"Active"});

  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div><h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:4}}>Security Alerts</h1><p style={{color:"var(--muted)",fontSize:".87rem"}}>All detected threats and security events.</p></div>
        <button className="btn btn-ghost" style={{fontSize:".8rem"}} onClick={exportReport}>⬇ Export Report</button>
      </div>
      {selectedAlert&&<AlertActionModal alert={selectedAlert} onAction={handleAction} onClose={()=>setSelectedAlert(null)}/>}
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {all.map((a,i)=>{
          const key=`${a.desc}-${a.time}`;
          const st=statuses[key]||a.status;
          return(
            <div key={i} className="glass" style={{padding:18,borderLeft:`3px solid ${SEV_COLOR[a.severity]||"#00ffaa"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:11}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5}}>
                    <span className="tag" style={{background:`${SEV_COLOR[a.severity]}18`,color:SEV_COLOR[a.severity],border:`1px solid ${SEV_COLOR[a.severity]}33`}}>{a.severity}</span>
                    <span style={{fontWeight:600,fontSize:".9rem"}}>{a.desc}</span>
                  </div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:".73rem",color:"var(--muted)"}}>{fmtDT(a.time||Date.now())} • Status: <span style={{color:"var(--neon)"}}>{st}</span></div>
                </div>
                <button className="btn btn-ghost" style={{fontSize:".78rem",padding:"6px 14px",flexShrink:0}} onClick={()=>setSelectedAlert(a)}>Respond →</button>
              </div>
            </div>
          );
        })}
        {all.length===0&&<div style={{textAlign:"center",padding:56,color:"var(--muted)"}}>No alerts — system is secure. ✓</div>}
      </div>
      <div style={{marginTop:20}}>
        <button className="btn btn-ghost" style={{fontSize:".8rem"}} onClick={()=>FileEngine.downloadReport("Audit Log",{events:behaviorEvents})}>⬇ Download Audit Log</button>
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────
function AnalyticsPage(){
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const logins=[42,38,55,67,72,29,18];
  const risks=[25,30,20,45,38,15,10];
  const alertTypes=[{l:"Brute Force",c:14,col:"#ff2244"},{l:"New Device",c:8,col:"#ff6600"},{l:"Behavioral",c:22,col:"#ffcc00"},{l:"IP Anomaly",c:6,col:"#0088ff"},{l:"Data Access",c:3,col:"#00ffaa"}];
  const maxA=Math.max(...alertTypes.map(a=>a.c));
  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div><h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:4}}>Analytics & Visualization</h1><p style={{color:"var(--muted)",fontSize:".87rem"}}>Security metrics and behavioral patterns over time.</p></div>
        <button className="btn btn-ghost" style={{fontSize:".8rem"}} onClick={()=>FileEngine.downloadReport("Analytics Report",{logins,risks,alertTypes})}>⬇ Export Data</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="glass" style={{padding:22}}>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:14}}>LOGIN ACTIVITY (WEEKLY)</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:7,height:90,marginBottom:7}}>
            {logins.map((v,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}><div style={{width:"100%",height:`${(v/72)*100}%`,background:"linear-gradient(to top,#00ffaa88,#00ffaa18)",borderRadius:"3px 3px 0 0"}}/></div>
                <span style={{fontSize:".62rem",color:"var(--muted)"}}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass" style={{padding:22}}>
          <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:14}}>RISK SCORE TREND (WEEKLY)</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:7,height:90,marginBottom:7}}>
            {risks.map((v,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}><div style={{width:"100%",height:`${(v/45)*100}%`,background:`linear-gradient(to top,${v>40?"#ff224488":v>25?"#ffcc0088":"#00ffaa88"},${v>40?"#ff224418":v>25?"#ffcc0018":"#00ffaa18"})`,borderRadius:"3px 3px 0 0"}}/></div>
                <span style={{fontSize:".62rem",color:"var(--muted)"}}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass" style={{padding:22,marginBottom:14}}>
        <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:18}}>ALERT FREQUENCY BY TYPE</div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {alertTypes.map(a=>(
            <div key={a.l} style={{display:"flex",alignItems:"center",gap:11}}>
              <span style={{width:88,fontSize:".8rem",color:"var(--text)",flexShrink:0}}>{a.l}</span>
              <div style={{flex:1,height:18,background:"rgba(255,255,255,.03)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(a.c/maxA)*100}%`,background:a.col,borderRadius:3,display:"flex",alignItems:"center",paddingLeft:8,transition:"width .5s ease"}}><span style={{fontSize:".68rem",fontWeight:700,color:"#020b12"}}>{a.c}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass" style={{padding:22}}>
        <div style={{fontSize:".72rem",color:"var(--muted)",letterSpacing:.8,marginBottom:14}}>BEHAVIORAL HEATMAP (24H)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(24,1fr)",gap:2}}>
          {Array.from({length:96},(_,i)=>{const v=Math.random();const col=v>.8?"#ff2244":v>.6?"#ffcc00":v>.3?"#00ffaa":"#0088ff";return <div key={i} style={{height:14,borderRadius:2,background:col,opacity:v*.85+.1}}/>;})}
        </div>
        <div style={{display:"flex",gap:14,marginTop:10,fontSize:".72rem",color:"var(--muted)"}}>
          {[["Low","#0088ff"],["Normal","#00ffaa"],["High","#ffcc00"],["Critical","#ff2244"]].map(([l,c])=>(
            <span key={l} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:9,height:9,borderRadius:2,background:c,display:"inline-block"}}/>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Devices Page ─────────────────────────────────────────────────────────
function DevicesPage(){
  const [devices,setDevices]=useState([
    {id:1,name:"Chrome / Windows 11",ip:"192.168.1.105",loc:"New York, USA",last:"Current session",trusted:true,current:true},
    {id:2,name:"Safari / MacBook Pro",ip:"192.168.1.82",loc:"San Francisco, USA",last:"2 hours ago",trusted:true,current:false},
    {id:3,name:"Firefox / Ubuntu",ip:"10.0.0.45",loc:"Austin, USA",last:"Yesterday",trusted:true,current:false},
    {id:4,name:"Chrome / Android",ip:"172.16.0.12",loc:"Chicago, USA",last:"3 days ago",trusted:false,current:false},
  ]);
  const trust=(id)=>setDevices(d=>d.map(x=>x.id===id?{...x,trusted:true}:x));
  const remove=(id)=>{ if(window.confirm("Remove this device?"))setDevices(d=>d.filter(x=>x.id!==id)); };
  return(
    <div className="fade-in">
      <h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:6}}>Trusted Devices</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:".87rem"}}>Manage devices that have access to your SentinelAI account.</p>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {devices.map(d=>(
          <div key={d.id} className="glass" style={{padding:18,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{width:42,height:42,borderRadius:9,background:"rgba(0,255,170,.07)",border:"1px solid var(--gb)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{d.current?"◎":"⊡"}</div>
            <div style={{flex:1,minWidth:160}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontWeight:600,fontSize:".9rem"}}>{d.name}</span>
                {d.current&&<span className="tag" style={{background:"rgba(0,255,170,.09)",color:"var(--neon)",border:"1px solid rgba(0,255,170,.2)"}}>CURRENT</span>}
                {d.trusted&&!d.current&&<span className="tag" style={{background:"rgba(0,136,255,.09)",color:"#0088ff",border:"1px solid rgba(0,136,255,.2)"}}>TRUSTED</span>}
                {!d.trusted&&<span className="tag" style={{background:"rgba(255,204,0,.09)",color:"#ffcc00",border:"1px solid rgba(255,204,0,.2)"}}>UNKNOWN</span>}
              </div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:".75rem",color:"var(--muted)"}}>{d.ip} • {d.loc} • {d.last}</div>
            </div>
            {!d.current&&(
              <div style={{display:"flex",gap:7}}>
                {!d.trusted&&<button className="btn btn-success" style={{fontSize:".78rem",padding:"6px 13px"}} onClick={()=>trust(d.id)}>Trust Device</button>}
                <button className="btn btn-danger" style={{fontSize:".78rem",padding:"6px 13px"}} onClick={()=>remove(d.id)}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inbox Page ───────────────────────────────────────────────────────────
function InboxPage({user,onUnreadUpdate}){
  const [emails,setEmails]=useState([]);
  const [selected,setSelected]=useState(null);
  const [filter,setFilter]=useState("all");

  const refresh=useCallback(()=>{
    const all=EmailEngine.getAll(user.email);
    setEmails(all);
    onUnreadUpdate(all.filter(e=>!e.read).length);
  },[user.email]);

  useEffect(()=>{ refresh(); const t=setInterval(refresh,3000); return()=>clearInterval(t); },[refresh]);

  const filtered=filter==="all"?emails:emails.filter(e=>e.type===filter);
  const typeIcon={otp:"🔐",alert:"🚨",behavior:"⚠",reset:"🔑",file:"📁",welcome:"👋"};
  const typeLab={otp:"OTP",alert:"Alert",behavior:"Behavior",reset:"Reset",file:"File",welcome:"Welcome"};
  const typeColor={otp:"#0088ff",alert:"#ff2244",behavior:"#ffcc00",reset:"#0088ff",file:"#00ffaa",welcome:"#00ffaa"};

  return(
    <div className="fade-in">
      {selected&&<EmailViewModal email={selected} onClose={()=>{setSelected(null);refresh();}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:4}}>Security Inbox</h1><p style={{color:"var(--muted)",fontSize:".87rem"}}>All automated security emails sent to <span style={{color:"var(--neon)"}}>{user.email}</span></p></div>
        <button className="btn btn-ghost" style={{fontSize:".78rem"}} onClick={refresh}>↻ Refresh</button>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {[["all","All"],["otp","OTP"],["alert","Alerts"],["behavior","Behavior"],["file","Files"],["reset","Reset"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{background:filter===v?"rgba(0,255,170,.15)":"rgba(0,255,170,.04)",border:`1px solid ${filter===v?"rgba(0,255,170,.4)":"rgba(0,255,170,.12)"}`,color:filter===v?"var(--neon)":"var(--muted)",borderRadius:6,padding:"5px 13px",cursor:"pointer",fontSize:".78rem",fontWeight:600,fontFamily:"'Exo 2',sans-serif"}}>{l}{filter!==v&&emails.filter(e=>v==="all"||e.type===v).filter(x=>!x.read).length>0&&<span style={{color:"#ff2244",marginLeft:4}}>●</span>}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:52,color:"var(--muted)"}}>No emails yet. Emails appear here after login events, file uploads, and security alerts.</div>}
        {filtered.map(e=>(
          <div key={e.id} className="glass" style={{padding:"14px 18px",cursor:"pointer",borderLeft:`3px solid ${typeColor[e.type]||"var(--neon)"}`,opacity:e.read?.95:1,transition:"all .2s"}} onClick={()=>setSelected(e)}>
            <div style={{display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
              <span style={{fontSize:"1.1rem",flexShrink:0}}>{typeIcon[e.type]||"📧"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  {!e.read&&<div style={{width:7,height:7,borderRadius:"50%",background:"var(--neon)",flexShrink:0}}/>}
                  <span style={{fontWeight:e.read?500:700,fontSize:".88rem",color:e.read?"var(--muted)":"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</span>
                </div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:".72rem",color:"var(--muted)"}}>{fmtDT(e.time)} • <span style={{color:typeColor[e.type]}}>{typeLab[e.type]||"Email"}</span></div>
              </div>
              <span style={{fontSize:".75rem",color:"var(--neon)",flexShrink:0}}>Open →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────
function SettingsPage({user,onUpdateUser}){
  const [tab,setTab]=useState("profile");
  const [form,setForm]=useState({name:user.name,email:user.email,org:user.org||""});
  const [passForm,setPassForm]=useState({current:"",newp:"",confirm:""});
  const [err,setErr]=useState("");
  const [success,setSuccess]=useState("");
  const [toggles,setToggles]=useState({twofa:true,emailAlerts:true,aiMonitor:true,deviceFingerprint:true,geoVerify:false,sessionRecord:false});
  const [emailKey,setEmailKey]=useState(localStorage.getItem('emailjs_public_key')||"");
  const [testRecipient,setTestRecipient]=useState("");
  const [testStatus,setTestStatus]=useState("");

  const showSuccess=(m)=>{setSuccess(m);setTimeout(()=>setSuccess(""),3000);};

  const saveProfile=()=>{
    if(!form.name||!form.email) return setErr("Name and email required.");
    const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
    const idx=users.findIndex(u=>u.id===user.id);
    if(idx!==-1){users[idx]={...users[idx],...form};localStorage.setItem("sentinel_users",JSON.stringify(users));onUpdateUser({...user,...form});}
    showSuccess("Profile updated successfully.");setErr("");
  };

  const savePass=()=>{
    const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
    const u=users.find(x=>x.id===user.id);
    if(!u||u.password!==passForm.current) return setErr("Current password is incorrect.");
    if(passForm.newp.length<6) return setErr("New password must be at least 6 characters.");
    if(passForm.newp!==passForm.confirm) return setErr("Passwords do not match.");
    const idx=users.findIndex(x=>x.id===user.id);
    users[idx].password=passForm.newp; localStorage.setItem("sentinel_users",JSON.stringify(users));
    setPassForm({current:"",newp:"",confirm:""}); setErr("");
    showSuccess("Password changed successfully.");
  };

  const toggle=(k)=>setToggles(t=>({...t,[k]:!t[k]}));

  const exportAccountData=()=>FileEngine.downloadReport("Account Data",{name:user.name,email:user.email,org:user.org,joined:fmtDT(user.joined),files:user.files?.length,alerts:user.alerts?.length});

  const saveEmailKey=()=>{
    try{ localStorage.setItem('emailjs_public_key', emailKey); emailjs.init(emailKey); setTestStatus('Public key saved'); setTimeout(()=>setTestStatus(''),2500);}catch(e){setTestStatus('Failed to save key');}
  };

  const sendTestEmail=async()=>{
    setTestStatus('Sending...');
    const serviceId = 'service_dl5mmsr';
    const templateId = 'template_dead8ln';
    const publicKey = localStorage.getItem('emailjs_public_key')||emailKey;
    if(!publicKey){ setTestStatus('No public key set'); return; }
    try{
      const params = { to_email: testRecipient || user.email, subject: 'SentinelAI Test Email', body_html: 'This is a test email from SentinelAI', timestamp: new Date().toLocaleString() };
      const res = await emailjs.send(serviceId, templateId, params, publicKey);
      console.log('EmailJS test res', res);
      setTestStatus('Sent — check inbox (or spam)');
    }catch(e){ console.error('EmailJS test error', e); setTestStatus('Send failed — check console'); }
    setTimeout(()=>setTestStatus(''),4000);
  };

  return(
    <div className="fade-in">
      <h1 style={{fontSize:"1.75rem",fontWeight:800,marginBottom:6}}>Settings</h1>
      <p style={{color:"var(--muted)",marginBottom:22,fontSize:".87rem"}}>Manage your account, security preferences, and data.</p>
      <div style={{display:"flex",gap:7,marginBottom:22,borderBottom:"1px solid var(--gb)",paddingBottom:16}}>
        {[["profile","👤 Profile"],["password","🔑 Password"],["security","🛡 Security"],["data","📦 Data"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setTab(v);setErr("");setSuccess("");}} style={{background:tab===v?"rgba(0,255,170,.12)":"transparent",border:`1px solid ${tab===v?"rgba(0,255,170,.4)":"rgba(0,255,170,.1)"}`,color:tab===v?"var(--neon)":"var(--muted)",borderRadius:7,padding:"7px 16px",cursor:"pointer",fontSize:".82rem",fontWeight:600,fontFamily:"'Exo 2',sans-serif"}}>{l}</button>
        ))}
      </div>
      {err&&<div style={{background:"rgba(255,34,68,.09)",border:"1px solid #ff2244",color:"#ff6677",borderRadius:7,padding:"9px 13px",marginBottom:14,fontSize:".83rem"}}>⚠ {err}</div>}
      {success&&<div style={{background:"rgba(0,255,170,.08)",border:"1px solid rgba(0,255,170,.3)",color:"var(--neon)",borderRadius:7,padding:"9px 13px",marginBottom:14,fontSize:".83rem"}}>✓ {success}</div>}
      {tab==="profile"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:440}}>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>FULL NAME</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>EMAIL ADDRESS</label><input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>ORGANIZATION</label><input className="input" value={form.org} onChange={e=>setForm(f=>({...f,org:e.target.value}))}/></div>
          <button className="btn btn-primary" onClick={saveProfile} style={{width:180,padding:"11px"}}>Save Profile →</button>
        </div>
      )}
      {tab==="password"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:440}}>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>CURRENT PASSWORD</label><input className="input" type="password" placeholder="Enter current password" value={passForm.current} onChange={e=>setPassForm(f=>({...f,current:e.target.value}))}/></div>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>NEW PASSWORD</label><input className="input" type="password" placeholder="Min 6 characters" value={passForm.newp} onChange={e=>setPassForm(f=>({...f,newp:e.target.value}))}/></div>
          <div><label style={{fontSize:".74rem",color:"var(--muted)",display:"block",marginBottom:5}}>CONFIRM NEW PASSWORD</label><input className="input" type="password" placeholder="Repeat new password" value={passForm.confirm} onChange={e=>setPassForm(f=>({...f,confirm:e.target.value}))}/></div>
          <button className="btn btn-primary" onClick={savePass} style={{width:180,padding:"11px"}}>Update Password →</button>
        </div>
      )}
      {tab==="security"&&(
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {[["twofa","Two-Factor Authentication","Require OTP on every login"],["emailAlerts","Email Security Alerts","Receive alerts for suspicious attempts"],["aiMonitor","AI Behavioral Monitoring","Continuous session anomaly detection"],["deviceFingerprint","Device Fingerprinting","Track and verify trusted devices"],["geoVerify","Geolocation Verification","Alert on logins from new locations"],["sessionRecord","Session Recording","Record activity for audit purposes"]].map(([k,t,d])=>(
            <div key={k} className="glass" style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{flex:1}}><div style={{fontWeight:600,marginBottom:2,fontSize:".9rem"}}>{t}</div><div style={{fontSize:".78rem",color:"var(--muted)"}}>{d}</div></div>
              <div onClick={()=>toggle(k)} style={{width:42,height:22,borderRadius:11,background:toggles[k]?"var(--neon)":"rgba(255,255,255,.09)",position:"relative",cursor:"pointer",transition:"all .25s",flexShrink:0}}>
                <div style={{width:16,height:16,borderRadius:"50%",background:"#020b12",position:"absolute",top:3,left:toggles[k]?23:3,transition:"left .25s"}}/>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab==="data"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="glass" style={{padding:20,marginBottom:14}}>
            <div style={{fontWeight:600,marginBottom:8}}>EmailJS Settings & Test</div>
            <div style={{fontSize:".82rem",color:"var(--muted)",marginBottom:8}}>Save your EmailJS Public Key and send a test email to verify delivery.</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input className="input" placeholder="EmailJS Public Key" value={emailKey} onChange={e=>setEmailKey(e.target.value)} style={{flex:1}} />
              <button className="btn btn-primary" onClick={saveEmailKey}>Save Key</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input className="input" placeholder="Test recipient email (optional)" value={testRecipient} onChange={e=>setTestRecipient(e.target.value)} style={{flex:1}} />
              <button className="btn btn-success" onClick={sendTestEmail}>Send Test Email</button>
            </div>
            {testStatus&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>{testStatus}</div>}
          </div>
          <div className="glass" style={{padding:20}}>
            <div style={{fontWeight:600,marginBottom:4}}>Export Account Data</div>
            <div style={{fontSize:".82rem",color:"var(--muted)",marginBottom:14}}>Download a copy of your account information and security settings.</div>
            <button className="btn btn-ghost" style={{fontSize:".82rem"}} onClick={exportAccountData}>⬇ Export Account Data</button>
          </div>
          <div className="glass" style={{padding:20}}>
            <div style={{fontWeight:600,marginBottom:4}}>Account Information</div>
            {[["Name",user.name],["Email",user.email],["Organization",user.org||"—"],["Member Since",fmtDT(user.joined)],["Files Stored",user.files?.length||0],["Security Codes Remaining",(user.securityCodes||[]).filter(c=>!c.used).length]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(0,255,170,.04)",fontSize:".84rem"}}>
                <span style={{color:"var(--muted)"}}>{l}</span><span style={{color:"var(--text)",fontFamily:"'Share Tech Mono',monospace"}}>{v}</span>
              </div>
            ))}
          </div>
          <div className="glass" style={{padding:20,borderColor:"rgba(255,34,68,.2)"}}>
            <div style={{fontWeight:600,marginBottom:4,color:"var(--red)"}}>Danger Zone</div>
            <div style={{fontSize:".82rem",color:"var(--muted)",marginBottom:14}}>Permanently delete your account and all stored data. This cannot be undone.</div>
            <button className="btn btn-danger" style={{fontSize:".82rem"}} onClick={()=>window.confirm("Are you sure? This will delete everything.")&&alert("Account deletion simulated — no actual data was deleted.")}>Delete My Account</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suspicious Banner ────────────────────────────────────────────────────
function SuspiciousBanner({onDismiss,onVerify}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:999,background:"rgba(255,34,68,.96)",padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,backdropFilter:"blur(8px)",borderBottom:"1px solid #ff224477"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:"1.1rem",animation:"blink 1s infinite"}}>🚨</span>
        <div><strong style={{fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>SUSPICIOUS ACTIVITY DETECTED</strong><div style={{fontSize:".78rem",opacity:.88}}>AI engine flagged anomalous behavior. Automated alert sent to your email.</div></div>
      </div>
      <div style={{display:"flex",gap:7,flexShrink:0}}>
        <button className="btn" style={{background:"rgba(255,255,255,.18)",color:"#fff",fontSize:".78rem",padding:"6px 13px",border:"none"}} onClick={onDismiss}>Dismiss</button>
        <button className="btn" style={{background:"#fff",color:"#ff2244",fontSize:".78rem",padding:"6px 13px",border:"none",fontWeight:700}} onClick={onVerify}>🔐 Verify Identity</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("login");
  const [user,setUser]=useState(null);
  const [showSimulate,setShowSimulate]=useState(false);
  const [realtimeAlerts,setRealtimeAlerts]=useState([]);
  const [page,setPage]=useState("dashboard");
  const [riskScore,setRiskScore]=useState(rand(14,32));
  const [behaviorEvents,setBehaviorEvents]=useState([]);
  const [behaviorStatus,setBehaviorStatus]=useState("normal");
  const [sessionAlerts,setSessionAlerts]=useState([]);
  const [showBanner,setShowBanner]=useState(false);
  const [unreadEmails,setUnreadEmails]=useState(0);
  const [showVerify,setShowVerify]=useState(false);
  const moveCount=useRef(0),clickCount=useRef(0),lastMove=useRef(Date.now());

  // Seed demo user
  useEffect(()=>{
    const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");
    if(!users.find(u=>u.email==="demo@sentinel.ai")){
      const demo={id:1,name:"Alex Johnson",email:"demo@sentinel.ai",password:"demo123",org:"SentinelAI Corp",files:MOCK_FILES,alerts:MOCK_ALERTS,joined:Date.now()-864000000,securityCodes:DEMO_CODES.map(c=>({code:c,used:false}))};
      users.unshift(demo); localStorage.setItem("sentinel_users",JSON.stringify(users));
      // create a demo access key for file 1
      AccessKeyEngine.generate(demo.id, MOCK_FILES[0].id, 3);
    }
  },[]);

  // Initialize EmailJS public key (store in localStorage if not present)
  useEffect(()=>{
    try{
      const existing = localStorage.getItem('emailjs_public_key');
      const provided = 'YvYEzWrnqPNl0vRZS';
      const key = existing||provided;
      if(key) {
        localStorage.setItem('emailjs_public_key', key);
        try{ emailjs.init(key); }catch(e){}
      }
    }catch(e){console.warn('EmailJS init failed',e);}    
  },[]);

  // Listen for key-used events dispatched by AccessKeyEngine
  useEffect(()=>{
    const h=(e)=>{
      const ev=e.detail;
      // attach to realtime popups
      setRealtimeAlerts(prev=>[ev,...prev].slice(0,6));
      // if the current logged in user is the owner, also add to session alerts
      if(user&&user.id===ev.ownerId){
        setSessionAlerts(prev=>[{desc:`Access key used on ${ev.fileName} by ${ev.externalUser}`,severity:"High",time:ev.time,status:"Active"},...prev]);
      }
    };
    window.addEventListener('sentinel:keyUsed',h);
    return()=>window.removeEventListener('sentinel:keyUsed',h);
  },[user]);

  const addEvent=useCallback((desc,suspicious=false)=>{
    setBehaviorEvents(prev=>[{desc,time:Date.now(),suspicious},...prev].slice(0,60));
    if(suspicious){
      setShowBanner(true); setBehaviorStatus("suspicious");
      setRiskScore(r=>Math.min(98,r+rand(12,20)));
      const a={desc:`AI Anomaly: ${desc}`,severity:"High",time:Date.now(),status:"Active"};
      setSessionAlerts(prev=>[a,...prev]);
      if(user) Emails.behaviorAlert(user.email,desc,"HIGH");
    }
  },[user]);

  useEffect(()=>{
    if(screen!=="app") return;
    const onMove=()=>{moveCount.current++;lastMove.current=Date.now();};
    const onClick=()=>{clickCount.current++;if(clickCount.current>40){addEvent("Extremely high click frequency — possible automation",true);clickCount.current=0;}};
    document.addEventListener("mousemove",onMove);
    document.addEventListener("click",onClick);
    const iv=setInterval(()=>{
      const idle=Date.now()-lastMove.current;
      if(idle>45000) addEvent("Extended idle period >45s — session may be unattended");
      else if(moveCount.current>300){addEvent("Erratic rapid mouse movement pattern detected",true);moveCount.current=0;}
      else if(moveCount.current>0) addEvent(`Heartbeat — ${moveCount.current} moves, ${clickCount.current} clicks`);
      moveCount.current=0;clickCount.current=0;
      setRiskScore(r=>Math.max(5,Math.min(95,r+(Math.random()>.72?rand(-6,12):rand(-4,4)))));
    },18000);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("click",onClick);clearInterval(iv);};
  },[screen,addEvent]);

  // Poll unread emails
  useEffect(()=>{
    if(!user||screen!=="app") return;
    const t=setInterval(()=>setUnreadEmails(EmailEngine.unreadCount(user.email)),4000);
    return()=>clearInterval(t);
  },[user,screen]);

  const handleLogin=(u)=>{ const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]"); setUser(users.find(x=>x.id===u.id)||u); setScreen("security_code"); };
  const handleSecCode=()=>setScreen("otp");
  const handleOTP=()=>{ if(Math.random()<.38)setScreen("device_alert"); else{setScreen("app");addEvent("Session started — all authentication layers passed ✓");} };
  const handleApprove=()=>{setScreen("app");addEvent("New device approved — session started");};
  const handleDeny=()=>{setScreen("login");setUser(null);};
  const handleLogout=()=>{setUser(null);setScreen("login");setBehaviorEvents([]);setBehaviorStatus("normal");setRiskScore(rand(14,32));setSessionAlerts([]);setShowBanner(false);setPage("dashboard");};

  const handleFileUpload=(name,size)=>{
    const sizeStr=size>1048576?`${(size/1048576).toFixed(1)} MB`:size>1024?`${(size/1024).toFixed(0)} KB`:`${size} B`;
    const f={id:Date.now(),name,size:sizeStr,type:name.includes(".json")?"config":name.includes(".csv")||name.includes(".xlsx")?"spreadsheet":name.includes(".pem")||name.includes(".key")?"key":"default",protected:true,uploaded:Date.now()};
    setUser(u=>{const nu={...u,files:[f,...(u.files||[])]};const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");const idx=users.findIndex(x=>x.id===nu.id);if(idx!==-1){users[idx]=nu;localStorage.setItem("sentinel_users",JSON.stringify(users));}return nu;});
    addEvent(`File uploaded: ${name}`);
    if(user) Emails.fileUploaded(user.email,name,sizeStr);
    setPage("files");
  };

  const handleDeleteFile=(id)=>{
    setUser(u=>{const nu={...u,files:(u.files||[]).filter(f=>f.id!==id)};const users=JSON.parse(localStorage.getItem("sentinel_users")||"[]");const idx=users.findIndex(x=>x.id===nu.id);if(idx!==-1){users[idx]=nu;localStorage.setItem("sentinel_users",JSON.stringify(users));}return nu;});
  };

  const handleAlertAction=(a,action)=>{ addEvent(`Alert response: "${action}" on "${a.desc}"`); };

  const handleUpdateUser=(nu)=>{setUser(nu);};

  if(screen==="signup") return <SignupPage onSignup={()=>setScreen("login")} onGoLogin={()=>setScreen("login")}/>;
  if(screen==="login") return <LoginPage onLogin={handleLogin} onGoSignup={()=>setScreen("signup")}/>;
  if(screen==="security_code"&&user) return <SecurityCodePage user={user} onVerified={handleSecCode} onBack={()=>{setScreen("login");setUser(null);}}/>;
  if(screen==="otp"&&user) return <OTPPage user={user} onVerified={handleOTP}/>;
  if(screen==="device_alert"&&user) return <DeviceAlertPage user={user} onApprove={handleApprove} onDeny={handleDeny}/>;

  if(screen==="app"&&user) return(
    <div style={{minHeight:"100vh"}}>
      <ParticleCanvas/>
      {showBanner&&<SuspiciousBanner onDismiss={()=>setShowBanner(false)} onVerify={()=>setShowVerify(true)}/>}
      {showVerify&&<VerifyIdentityModal user={user} onVerified={()=>{addEvent("Identity re-verified — session marked secure");setBehaviorStatus("normal");setShowBanner(false);}} onClose={()=>setShowVerify(false)}/>}
      {realtimeAlerts.map((ev,i)=> user&&user.id===ev.ownerId && <RealTimeAlertPopup key={ev.id} ev={ev} onClose={()=>setRealtimeAlerts(r=>r.filter(x=>x.id!==ev.id))} onRevoke={(k)=>{AccessKeyEngine.revoke(k); setRealtimeAlerts(r=>r.filter(x=>x.key!==k)); setSessionAlerts(prev=>[{desc:`Access key revoked: ${k}`,severity:"High",time:Date.now(),status:"Revoked"},...prev]);}} onMarkSafe={(e)=>{const evs=JSON.parse(localStorage.getItem("sentinel_key_events")||"[]"); const idx=evs.findIndex(x=>x.id===e.id); if(idx!==-1){evs[idx].markedSafe=true; localStorage.setItem("sentinel_key_events",JSON.stringify(evs));} setRealtimeAlerts(r=>r.filter(x=>x.id!==e.id)); setSessionAlerts(prev=>[{desc:`Key use marked safe: ${e.key}`,severity:"Low",time:Date.now(),status:"Safe"},...prev]);}} onAllow={(e)=>{setRealtimeAlerts(r=>r.filter(x=>x.id!==e.id)); setSessionAlerts(prev=>[{desc:`Key use allowed: ${e.key}`,severity:"Low",time:Date.now(),status:"Allowed"},...prev]);}} />)}
      <Sidebar active={page} onNav={setPage} user={user} onLogout={handleLogout} unreadEmails={unreadEmails} onSimulateOpen={()=>setShowSimulate(true)}/>
      {showSimulate&&<SimulateKeyModal onClose={()=>setShowSimulate(false)}/>} 
      <div className="main-content" style={{paddingTop:showBanner?72:30}}>
        {page==="dashboard"&&<DashboardPage user={user} riskScore={riskScore} sessionAlerts={sessionAlerts} behaviorStatus={behaviorStatus} onVerifyIdentity={()=>setShowVerify(true)}/>}
        {page==="monitoring"&&<MonitoringPage events={behaviorEvents} behaviorStatus={behaviorStatus} riskScore={riskScore} onVerifyIdentity={()=>setShowVerify(true)}/>}
        {page==="files"&&<FilesPage user={user} onUpload={handleFileUpload} onDeleteFile={handleDeleteFile}/>}
        {page==="alerts"&&<AlertsPage alerts={user.alerts||[]} sessionAlerts={sessionAlerts} onAction={handleAlertAction} user={user} riskScore={riskScore} behaviorEvents={behaviorEvents}/>}
        {page==="analytics"&&<AnalyticsPage/>}
        {page==="devices"&&<DevicesPage/>}
        {page==="inbox"&&<InboxPage user={user} onUnreadUpdate={setUnreadEmails}/>}
        {page==="settings"&&<SettingsPage user={user} onUpdateUser={handleUpdateUser}/>}
      </div>
    </div>
  );

  return null;
}

const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);
