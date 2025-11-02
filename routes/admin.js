const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Import MongoDB config
const config = require('../config');
const mongoose = require('mongoose');

// Ensure backups directory exists
const BACKUP_BASE_PATH = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_BASE_PATH)) {
  fs.mkdirSync(BACKUP_BASE_PATH, { recursive: true });
}

// Function: Take MongoDB dump
function takeDump() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = path.join(BACKUP_BASE_PATH, `mongo_backup_${timestamp}`);
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  
  const cmd = `mongodump --uri="${config.MONGODB_URI}" --db="${config.DATABASE_NAME}" --out="${backupPath}"`;
  
  console.log('🕒 Starting MongoDB dump...');
  
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Dump failed:', error.message);
        reject(error);
      } else {
        console.log('✅ Dump completed successfully:', backupPath);
        resolve({ backupPath, stdout });
      }
    });
  });
}

// Function: Cleanup (delete all data from all collections)
async function cleanupCollections() {
  try {
    // Use the existing mongoose connection instead of creating a new one
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const collections = await db.listCollections().toArray();
    
    for (const coll of collections) {
      await db.collection(coll.name).deleteMany({});
      console.log(`🧽 Cleaned collection: ${coll.name}`);
    }
    
    console.log('✅ All collections cleaned successfully.');
  } catch (err) {
    console.error('❌ Cleanup error:', err);
    throw err;
  }
}

// POST /api/admin/backup - trigger mongo backup (android_db only)
router.post('/backup', authenticateApiKey, async (req, res) => {
  try {
    // Immediate response to avoid timeout
    res.json({ 
      success: true, 
      message: 'Backup and cleanup triggered successfully',
      timestamp: new Date().toISOString()
    });
    
    // Run backup in background
    try {
      const { backupPath } = await takeDump();
      console.log('📦 Backup completed:', backupPath);
      
      // After successful backup, cleanup collections
      await cleanupCollections();
      console.log('🧹 Cleanup completed');
      
      // Optional: Send notification or log success
      console.log('✅ Backup + Cleanup process completed successfully');
    } catch (error) {
      console.error('❌ Background backup/cleanup failed:', error);
    }
  } catch (e) {
    console.error('❌ Backup trigger error:', e);
    // Don't send error response since we already sent success
  }
});

module.exports = router;
