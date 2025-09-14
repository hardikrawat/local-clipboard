const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import modules
const { testConnection, logger } = require('./config/database');
const ClipboardModel = require('./models/ClipboardModel');
const EncryptionManager = require('./crypto/encryption');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Authentication settings
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'MySecurePassword123!';
const AUTH_COOKIE_NAME = 'clipboard_auth';
const AUTH_COOKIE_MAXAGE = 24 * 60 * 60 * 1000; // 24 hours

// Initialize encryption manager
const encryption = new EncryptionManager();

// Test encryption on startup
console.log('Testing encryption system...');
const encryptionTest = encryption.test();
if (!encryptionTest) {
    console.error('❌ Encryption test failed! Server may not start properly.');
} else {
    console.log('✅ Encryption system working correctly');
}

// Client session management
const clientSessions = new Map();

// Connected clients tracking
let connectedClients = 0;
const connectedClientsList = new Map();

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

// Helper functions
function getDeviceInfo(userAgent) {
    const ua = userAgent.toLowerCase();
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
    
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    
    if (ua.includes('mobile') || ua.includes('android')) device = 'Mobile';
    else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';
    
    return { browser, os, device };
}

function getRealIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

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
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 }
});

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// AUTHENTICATION MIDDLEWARE
function authMiddleware(req, res, next) {
    // Check if user is authenticated via cookie
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME] === AUTH_PASSWORD) {
        return next();
    }
    
    // Allow access to login page and assets
    if (req.path === '/login' || 
        req.path === '/login.html' || 
        req.path === '/login.css' ||
        req.path.startsWith('/static-login/')) {
        return next();
    }
    
    // Redirect to login for all other routes
    return res.redirect('/login');
}

// Apply authentication middleware
app.use(authMiddleware);

// Serve protected static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

// CORRECTED decryption middleware
function decryptRequest(req, res, next) {
    if (req.body && req.body.encrypted) {
        try {
            const sessionId = req.body.sessionId || req.headers['x-session-id'];
            
            if (!sessionId || !clientSessions.has(sessionId)) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            // Decrypt the payload
            const decryptedData = encryption.decrypt(req.body, sessionId);
            req.body = decryptedData;
            req.sessionId = sessionId;
            
        } catch (error) {
            logger.error('Decryption error:', error);
            return res.status(400).json({ error: 'Decryption failed: ' + error.message });
        }
    }
    next();
}

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// AUTH ROUTES
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    const clientIP = getRealIP(req);
    
    if (password === AUTH_PASSWORD) {
        // Set secure cookie
        res.cookie(AUTH_COOKIE_NAME, AUTH_PASSWORD, {
            httpOnly: true,
            maxAge: AUTH_COOKIE_MAXAGE,
            secure: process.env.NODE_ENV === 'production', // HTTPS in production
            sameSite: 'strict'
        });
        
        logger.info(`Successful login from ${clientIP}`);
        return res.redirect('/?login=success');
    } else {
        logger.warn(`Failed login attempt from ${clientIP}`);
        return res.redirect('/login?error=1');
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.redirect('/login?logout=1');
});

// MAIN ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// CORRECTED crypto key exchange endpoint
app.post('/api/crypto/keys', (req, res) => {
    try {
        const clientKeys = encryption.generateClientKeys();
        clientSessions.set(clientKeys.sessionId, {
            created: Date.now(),
            ip: getRealIP(req),
            userAgent: req.headers['user-agent']
        });

        res.json({
            sessionId: clientKeys.sessionId,
            key: clientKeys.key // Base64 encoded key
        });
        
        logger.info(`New crypto session created: ${clientKeys.sessionId}`);
    } catch (error) {
        logger.error('Key generation error:', error);
        res.status(500).json({ error: 'Key generation failed' });
    }
});

// Test encryption endpoint
app.get('/api/test-crypto', (req, res) => {
    const testResult = encryption.test();
    res.json({ 
        success: testResult,
        message: testResult ? 'Encryption test passed' : 'Encryption test failed'
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({ 
        status: 'ok', 
        database: dbConnected ? 'connected' : 'disconnected',
        connectedClients: connectedClients,
        activeSessions: clientSessions.size,
        encryption: 'AES-256-GCM',
        authentication: 'Cookie-based',
        encryptionTest: encryption.test(),
        timestamp: new Date().toISOString()
    });
});

// Get connected clients list (encrypted response)
app.get('/api/clients', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || !clientSessions.has(sessionId)) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    try {
        const clientsData = {
            count: connectedClients,
            clients: Array.from(connectedClientsList.values())
        };

        const encryptedResponse = encryption.encrypt(clientsData, sessionId);
        res.json(encryptedResponse);
    } catch (error) {
        logger.error('Error encrypting clients data:', error);
        res.status(500).json({ error: 'Encryption failed' });
    }
});

// CORRECTED - Get all clipboard data (with encryption)
app.get('/api/clipboard', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || !clientSessions.has(sessionId)) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    try {
        const result = await ClipboardModel.getAllData();
        
        if (result.success) {
            const encryptedData = encryption.encrypt(result.data, sessionId);
            res.json(encryptedData);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error in /api/clipboard:', error);
        res.status(500).json({ error: 'Failed to fetch clipboard data' });
    }
});

// Add text to clipboard (with decryption)
app.post('/api/clipboard/text', decryptRequest, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Content cannot be empty' });
        }

        const result = await ClipboardModel.addText(content.trim());
        
        if (result.success) {
            // Emit encrypted update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                // Encrypt for each connected client
                connectedClientsList.forEach((client, socketId) => {
                    if (client.sessionId && clientSessions.has(client.sessionId)) {
                        try {
                            const encryptedUpdate = encryption.encrypt(allData.data, client.sessionId);
                            io.to(socketId).emit('clipboardUpdate', encryptedUpdate);
                        } catch (encError) {
                            logger.error('Error encrypting update for client:', encError);
                        }
                    }
                });
            }
            
            const encryptedResponse = encryption.encrypt(
                { success: true, data: result.data }, 
                req.sessionId
            );
            res.json(encryptedResponse);
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error adding text:', error);
        res.status(500).json({ error: 'Failed to add text' });
    }
});

// Upload file (with encryption)
app.post('/api/clipboard/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const sessionId = req.headers['x-session-id'];
        if (!sessionId || !clientSessions.has(sessionId)) {
            return res.status(401).json({ error: 'Invalid session' });
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
            // Emit encrypted update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                connectedClientsList.forEach((client, socketId) => {
                    if (client.sessionId && clientSessions.has(client.sessionId)) {
                        try {
                            const encryptedUpdate = encryption.encrypt(allData.data, client.sessionId);
                            io.to(socketId).emit('clipboardUpdate', encryptedUpdate);
                        } catch (encError) {
                            logger.error('Error encrypting update for client:', encError);
                        }
                    }
                });
            }
            
            const encryptedResponse = encryption.encrypt(
                { success: true, data: result.data }, 
                sessionId
            );
            res.json(encryptedResponse);
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

// Delete text entry (with decryption)
app.delete('/api/clipboard/text/:id', decryptRequest, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const result = await ClipboardModel.deleteText(id);
        
        if (result.success) {
            // Emit encrypted update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                connectedClientsList.forEach((client, socketId) => {
                    if (client.sessionId && clientSessions.has(client.sessionId)) {
                        try {
                            const encryptedUpdate = encryption.encrypt(allData.data, client.sessionId);
                            io.to(socketId).emit('clipboardUpdate', encryptedUpdate);
                        } catch (encError) {
                            logger.error('Error encrypting update for client:', encError);
                        }
                    }
                });
            }
            
            const encryptedResponse = encryption.encrypt({ success: true }, req.sessionId);
            res.json(encryptedResponse);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error deleting text:', error);
        res.status(500).json({ error: 'Failed to delete text' });
    }
});

// Delete file entry (with decryption)
app.delete('/api/clipboard/file/:id', decryptRequest, async (req, res) => {
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
            
            // Emit encrypted update to all clients
            const allData = await ClipboardModel.getAllData();
            if (allData.success) {
                connectedClientsList.forEach((client, socketId) => {
                    if (client.sessionId && clientSessions.has(client.sessionId)) {
                        try {
                            const encryptedUpdate = encryption.encrypt(allData.data, client.sessionId);
                            io.to(socketId).emit('clipboardUpdate', encryptedUpdate);
                        } catch (encError) {
                            logger.error('Error encrypting update for client:', encError);
                        }
                    }
                });
            }
            
            const encryptedResponse = encryption.encrypt({ success: true }, req.sessionId);
            res.json(encryptedResponse);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Clear all data (with decryption)
app.delete('/api/clipboard/clear', decryptRequest, async (req, res) => {
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
            
            // Emit encrypted update to all clients
            const emptyData = { texts: [], files: [] };
            connectedClientsList.forEach((client, socketId) => {
                if (client.sessionId && clientSessions.has(client.sessionId)) {
                    try {
                        const encryptedUpdate = encryption.encrypt(emptyData, client.sessionId);
                        io.to(socketId).emit('clipboardUpdate', encryptedUpdate);
                    } catch (encError) {
                        logger.error('Error encrypting update for client:', encError);
                    }
                }
            });
            
            const encryptedResponse = encryption.encrypt({ success: true }, req.sessionId);
            res.json(encryptedResponse);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error clearing clipboard:', error);
        res.status(500).json({ error: 'Failed to clear clipboard' });
    }
});

// Socket.io connection handling with encryption
io.on('connection', async (socket) => {
    const clientIP = getRealIP(socket.request);
    const userAgent = socket.request.headers['user-agent'] || 'Unknown';
    const deviceInfo = getDeviceInfo(userAgent);
    
    // Wait for client to establish crypto session
    socket.on('cryptoHandshake', (sessionId) => {
        if (!clientSessions.has(sessionId)) {
            socket.emit('cryptoError', 'Invalid session');
            return;
        }

        const clientInfo = {
            id: socket.id,
            ip: clientIP,
            userAgent: userAgent,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            device: deviceInfo.device,
            connectedAt: new Date(),
            lastActivity: new Date(),
            sessionId: sessionId
        };
        
        connectedClientsList.set(socket.id, clientInfo);
        connectedClients++;
        
        logger.info(`Encrypted client connected: ${clientIP} (${deviceInfo.browser}). Total: ${connectedClients}`);
        
        // Send encrypted responses
        io.emit('connectedClientsCount', connectedClients);
        
        // Send encrypted client list to all clients
        connectedClientsList.forEach((client, socketId) => {
            if (client.sessionId && clientSessions.has(client.sessionId)) {
                try {
                    const encryptedList = encryption.encrypt(
                        Array.from(connectedClientsList.values()), 
                        client.sessionId
                    );
                    io.to(socketId).emit('connectedClientsList', encryptedList);
                } catch (encError) {
                    logger.error('Error encrypting client list:', encError);
                }
            }
        });

        // Send initial encrypted clipboard data
        ClipboardModel.getAllData().then(result => {
            if (result.success) {
                try {
                    const encryptedData = encryption.encrypt(result.data, sessionId);
                    socket.emit('clipboardUpdate', encryptedData);
                } catch (encError) {
                    logger.error('Error encrypting initial data:', encError);
                }
            }
        }).catch(error => {
            logger.error('Error sending initial encrypted data:', error);
        });
    });
    
    socket.on('disconnect', () => {
        const clientInfo = connectedClientsList.get(socket.id);
        connectedClientsList.delete(socket.id);
        connectedClients--;
        
        if (clientInfo) {
            logger.info(`Encrypted client disconnected: ${clientInfo.ip}. Total: ${connectedClients}`);
        }
        
        io.emit('connectedClientsCount', connectedClients);
        
        // Send updated encrypted client list
        connectedClientsList.forEach((client, socketId) => {
            if (client.sessionId && clientSessions.has(client.sessionId)) {
                try {
                    const encryptedList = encryption.encrypt(
                        Array.from(connectedClientsList.values()), 
                        client.sessionId
                    );
                    io.to(socketId).emit('connectedClientsList', encryptedList);
                } catch (encError) {
                    logger.error('Error encrypting client list on disconnect:', encError);
                }
            }
        });
    });
});

// Cleanup expired sessions
setInterval(() => {
    const now = Date.now();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    clientSessions.forEach((session, sessionId) => {
        if (now - session.created > sessionTimeout) {
            clientSessions.delete(sessionId);
            logger.info(`Expired crypto session: ${sessionId}`);
        }
    });
}, 60 * 60 * 1000); // Check every hour

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

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();
    console.log('🚀 Local Clipboard Server (Encrypted & Protected) running on:');
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
    console.log(`\n🔐 Security Features:`);
    console.log(`   • Password Protection: ${AUTH_PASSWORD.substring(0, 3)}***`);
    console.log(`   • AES-256-GCM Encryption`);
    console.log(`   • Session-based Key Management`);
    console.log(`   • Cookie Authentication (24h expiry)`);
    console.log(`   • End-to-end Encrypted APIs`);
    console.log(`\nDatabase: Connected to MySQL`);
    console.log(`Connected clients: ${connectedClients}`);
});
