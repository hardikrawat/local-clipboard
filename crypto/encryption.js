const crypto = require('crypto');

class EncryptionManager {
    constructor() {
        // Generate or load master key
        this.masterKey = process.env.MASTER_KEY || this.generateMasterKey();
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 12;  // 96 bits for GCM (IMPORTANT: 12, not 16!)
        this.tagLength = 16; // 128 bits
    }

    generateMasterKey() {
        return crypto.randomBytes(this.keyLength).toString('hex');
    }

    // Derive encryption key from master key and session
    deriveKey(sessionId) {
        return crypto.pbkdf2Sync(
            Buffer.from(this.masterKey, 'hex'), 
            sessionId, 
            100000, 
            this.keyLength, 
            'sha256'
        );
    }

    // Encrypt data - CORRECTED VERSION
    encrypt(data, sessionId) {
        try {
            const key = this.deriveKey(sessionId);
            const iv = crypto.randomBytes(this.ivLength); // 12 bytes for GCM
            
            // CRITICAL: Use createCipheriv, not createCipher
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            const plaintext = JSON.stringify(data);
            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            
            // Get authentication tag AFTER final()
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Encryption failed: ' + error.message);
        }
    }

    // Decrypt data - CORRECTED VERSION
    decrypt(encryptedData, sessionId) {
        try {
            const key = this.deriveKey(sessionId);
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const authTag = Buffer.from(encryptedData.authTag, 'base64');
            
            // CRITICAL: Use createDecipheriv, not createDecipher
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            
            // Set auth tag BEFORE updating
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed: ' + error.message);
        }
    }

    // Generate client encryption keys
    generateClientKeys() {
        const sessionId = crypto.randomUUID();
        const derivedKey = this.deriveKey(sessionId);
        
        return {
            sessionId,
            key: derivedKey.toString('base64') // Send as base64
        };
    }

    // Test encryption/decryption
    test() {
        const sessionId = 'test-session-123';
        const testData = { message: 'Hello, World!', timestamp: Date.now() };
        
        try {
            console.log('Testing encryption...');
            const encrypted = this.encrypt(testData, sessionId);
            console.log('Encrypted:', encrypted);
            
            const decrypted = this.decrypt(encrypted, sessionId);
            console.log('Decrypted:', decrypted);
            
            const success = JSON.stringify(testData) === JSON.stringify(decrypted);
            console.log('Test result:', success ? 'PASSED' : 'FAILED');
            
            return success;
        } catch (error) {
            console.error('Test failed:', error);
            return false;
        }
    }
}

module.exports = EncryptionManager;
