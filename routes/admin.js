const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');
const { exec } = require('child_process');

// POST /api/admin/backup - trigger mongo backup (android_db only)
router.post('/backup', authenticateApiKey, async (req, res) => {
  try {
    const scriptPath = '/root/scripts/mongo_backup.sh';
    exec(`bash ${scriptPath}`, { timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ success: false, message: 'Backup failed', error: error.message, stderr });
      }
      return res.json({ success: true, message: 'Backup triggered', stdout });
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Backup trigger error', error: e.message });
  }
});

module.exports = router;
