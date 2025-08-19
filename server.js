const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import database modules
const { testConnection, logger } = require('./config/database');
const ClipboardModel = require('./models/ClipboardModel');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Create necessary directories
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const logsDir = path.join(__dirname, 'logs');

[uploadsDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Test database connection on startup
testConnection().then(connected => {
    if (!connected) {
        logger.error('Failed to connect to database. Exiting...');
        process.exit(1);
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
    fileFilter: (req, file, cb) => {
        // Add file type restrictions if needed
        cb(null, true);
    }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({ 
        status: 'ok', 
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Get all clipboard data
app.get('/api/clipboard', async (req, res) => {
    try {
        const result = await ClipboardModel.getAllData();
        
        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error in /api/clipboard:', error);
        res.status(500).json({ error: 'Failed to fetch clipboard data' });
    }
});

// Add text to clipboard
app.post('/api/clipboard/text', async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Content cannot be empty' });
        }

        const result = await ClipboardModel.addText(content.trim());
        
        if (result.success) {
            // Emit update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                io.emit('clipboardUpdate', allData.data);
            }
            
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error adding text:', error);
        res.status(500).json({ error: 'Failed to add text' });
    }
});

// Upload file
app.post('/api/clipboard/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileData = {
            original_name: req.file.originalname,
            filename: req.file.filename,
            file_size: req.file.size,
            mimetype: req.file.mimetype,
            download_url: `/uploads/${req.file.filename}`
        };

        const result = await ClipboardModel.addFile(fileData);
        
        if (result.success) {
            // Emit update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                io.emit('clipboardUpdate', allData.data);
            }
            
            res.json({ success: true, data: result.data });
        } else {
            // Delete uploaded file if database insert failed
            const filePath = path.join(uploadsDir, req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete text entry
app.delete('/api/clipboard/text/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const result = await ClipboardModel.deleteText(id);
        
        if (result.success) {
            // Emit update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                io.emit('clipboardUpdate', allData.data);
            }
            
            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error deleting text:', error);
        res.status(500).json({ error: 'Failed to delete text' });
    }
});

// Delete file entry
app.delete('/api/clipboard/file/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const result = await ClipboardModel.deleteFile(id);
        
        if (result.success) {
            // Delete physical file
            if (result.filename) {
                const filePath = path.join(uploadsDir, result.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            // Emit update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                io.emit('clipboardUpdate', allData.data);
            }
            
            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Clear all data
app.delete('/api/clipboard/clear', async (req, res) => {
    try {
        const result = await ClipboardModel.clearAll();
        
        if (result.success) {
            // Delete all physical files
            if (result.filenames && result.filenames.length > 0) {
                result.filenames.forEach(filename => {
                    const filePath = path.join(uploadsDir, filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
            }
            
            // Emit update to all clients
            io.emit('clipboardUpdate', { texts: [], files: [] });
            
            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error clearing clipboard:', error);
        res.status(500).json({ error: 'Failed to clear clipboard' });
    }
});

// Socket.io connection handling
io.on('connection', async (socket) => {
    logger.info('Client connected');
    
    // Send current data to new client
    try {
        const result = await ClipboardModel.getAllData();
        if (result.success) {
            socket.emit('clipboardUpdate', result.data);
        }
    } catch (error) {
        logger.error('Error sending initial data to client:', error);
    }
    
    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });
});

// Get local IP address
function getLocalIPAddress() {
    const interfaces = require('os').networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();
    console.log('🚀 Local Clipboard Server running on:');
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
    console.log('\nAccess from any device on your network using the Network URL');
    console.log(`Database: Connected to MySQL`);
});
