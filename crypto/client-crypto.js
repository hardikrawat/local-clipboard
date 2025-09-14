// Client-side encryption utilities
class ClientCrypto {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 96; // 96 bits for GCM
    }

    // Initialize encryption for client
    async initialize() {
        // Get encryption keys from server
        const response = await fetch('/api/crypto/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const keyData = await response.json();
        this.sessionId = keyData.sessionId;
        
        // Import the key
        this.cryptoKey = await window.crypto.subtle.importKey(
            'raw',
            this.hexToArrayBuffer(keyData.privateKey),
            { name: this.algorithm },
            false,
            ['encrypt', 'decrypt']
        );
        
        return true;
    }

    // Encrypt data client-side
    async encryptData(data) {
        if (!this.cryptoKey) {
            throw new Error('Crypto not initialized');
        }

        const iv = window.crypto.getRandomValues(new Uint8Array(this.ivLength / 8));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));
        
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: this.algorithm, iv: iv },
            this.cryptoKey,
            encodedData
        );
        
        return {
            encrypted: this.arrayBufferToHex(encryptedBuffer),
            iv: this.arrayBufferToHex(iv),
            sessionId: this.sessionId,
            timestamp: Date.now()
        };
    }

    // Decrypt data client-side
    async decryptData(encryptedData) {
        if (!this.cryptoKey) {
            throw new Error('Crypto not initialized');
        }

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { 
                name: this.algorithm, 
                iv: this.hexToArrayBuffer(encryptedData.iv) 
            },
            this.cryptoKey,
            this.hexToArrayBuffer(encryptedData.encrypted)
        );
        
        const decryptedText = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decryptedText);
    }

    // Generate request signature
    async signRequest(data) {
        const signingKey = await window.crypto.subtle.importKey(
            'raw',
            this.hexToArrayBuffer(this.sessionId.replace(/-/g, '')),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await window.crypto.subtle.sign(
            'HMAC',
            signingKey,
            new TextEncoder().encode(JSON.stringify(data))
        );

        return this.arrayBufferToHex(signature);
    }

    // Utility functions
    hexToArrayBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    arrayBufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
