const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const basename = path.basename(file.originalname, extension);
        cb(null, `${basename}-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow all file types for now, but you can add restrictions
        cb(null, true);
    }
});

// POST /api/upload - Upload media file
router.post('/', authenticateApiKey, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const file = req.file;
        const serverPath = file.path;
        const downloadUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                originalName: file.originalname,
                filename: file.filename,
                serverPath: serverPath,
                downloadUrl: downloadUrl,
                size: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
});

// GET /uploads/:filename - Serve uploaded files (must be after /stats route)
router.get('/file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadDir, filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Set appropriate headers
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to serve file',
            error: error.message
        });
    }
});

// GET /api/upload/stats - Get upload statistics
router.get('/stats', authenticateApiKey, (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir);
        const stats = {
            totalFiles: files.length,
            totalSize: 0,
            fileTypes: {},
            recentUploads: []
        };

        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            const stat = fs.statSync(filePath);
            stats.totalSize += stat.size;
            
            const extension = path.extname(file);
            stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;
            
            if (stat.mtime > new Date(Date.now() - 24 * 60 * 60 * 1000)) { // Last 24 hours
                stats.recentUploads.push({
                    filename: file,
                    size: stat.size,
                    uploadedAt: stat.mtime
                });
            }
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error getting upload stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get upload statistics',
            error: error.message
        });
    }
});

module.exports = router;
