#!/usr/bin/env node
// One-off script to create an admin user in the medsure MongoDB
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Try to load .env manually if dotenv isn't available
function loadEnv() {
  if (process.env.MONGODB_URI) return;
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const data = fs.readFileSync(envPath, 'utf8');
    data.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) {
        const key = m[1];
        let val = m[2] || '';
        // strip optional surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch (e) {
    // ignore if .env not found
  }
}

loadEnv();

async function main() {
  const [,, email, password, name] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> [name]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, default: 'admin' },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  }, { timestamps: true });

  const Admin = mongoose.model('Admin', adminSchema);

  try {
    const existing = await Admin.findOne({ email }).exec();
    if (existing) {
      console.log('Admin already exists:', email);
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = new Admin({ email, password: hashed, name: name || '', role: 'admin', isActive: true });
    await admin.save();
    console.log('Admin created:', email);
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err.message || err);
    process.exit(1);
  }
}

main();
