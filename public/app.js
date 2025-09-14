class LocalClipboard {
    constructor() {
        this.socket = io();
        this.crypto = null;
        this.sessionId = null;
        this.cryptoKey = null;
        this.initializeElements();
        this.setupEventListeners();
        this.initializeCrypto();
    }

    async initializeCrypto() {
        try {
            console.log('🔄 Initializing encryption...');
            
            // Get encryption keys from server
            const response = await fetch('/api/crypto/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to get crypto keys');
            }

            const keyData = await response.json();
            this.sessionId = keyData.sessionId;
            
            // Import the key for Web Crypto API
            const keyBuffer = this.base64ToArrayBuffer(keyData.key);
            this.cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );

            console.log('🔐 Encryption initialized with session:', this.sessionId.substring(0, 8) + '...');
            
            this.setupSocketListeners();
            this.socket.emit('cryptoHandshake', this.sessionId);
            
        } catch (error) {
            console.error('❌ Crypto initialization failed:', error);
            alert('Encryption setup failed. Please refresh the page.');
        }
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.fileInput = document.getElementById('fileInput');
        this.addTextBtn = document.getElementById('addText');
        this.uploadFileBtn = document.getElementById('uploadFile');
        this.clearAllBtn = document.getElementById('clearAll');
        this.textList = document.getElementById('textList');
        this.fileList = document.getElementById('fileList');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Client tracking elements
        this.toggleClientsBtn = document.getElementById('toggleClients');
        this.clientsPanel = document.getElementById('clientsPanel');
        this.closeClientsBtn = document.getElementById('closeClients');
        this.clientsList = document.getElementById('clientsList');
    }

    setupEventListeners() {
        this.addTextBtn.addEventListener('click', () => this.addText());
        this.uploadFileBtn.addEventListener('click', () => this.uploadFiles());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        
        // Client tracking listeners
        this.toggleClientsBtn.addEventListener('click', () => this.toggleClientsPanel());
        this.closeClientsBtn.addEventListener('click', () => this.hideClientsPanel());
        
        this.textInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.addText();
            }
        });
        
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length > 0) {
                this.uploadFiles();
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
        });

        this.socket.on('clipboardUpdate', async (encryptedData) => {
            try {
                const decryptedData = await this.decryptData(encryptedData);
                this.updateDisplay(decryptedData);
            } catch (error) {
                console.error('❌ Failed to decrypt clipboard update:', error);
            }
        });

        this.socket.on('connectedClientsCount', (count) => {
            this.updateClientCount(count);
        });

        this.socket.on('connectedClientsList', async (encryptedList) => {
            try {
                const decryptedList = await this.decryptData(encryptedList);
                this.updateClientsList(decryptedList);
            } catch (error) {
                console.error('❌ Failed to decrypt clients list:', error);
            }
        });

        this.socket.on('cryptoError', (error) => {
            console.error('❌ Crypto error:', error);
            alert('Encryption error: ' + error);
        });
    }

    // CORRECTED Client-side encryption using Web Crypto API
    async encryptData(data) {
        try {
            if (!this.cryptoKey) {
                throw new Error('Crypto not initialized');
            }

            const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
            const plaintext = JSON.stringify(data);
            const encodedData = new TextEncoder().encode(plaintext);
            
            const encryptedBuffer = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                this.cryptoKey,
                encodedData
            );
            
            // For Web Crypto API with AES-GCM, the auth tag is included in the result
            const encryptedArray = new Uint8Array(encryptedBuffer);
            const dataLength = encryptedArray.length - 16; // Last 16 bytes are auth tag
            const encrypted = encryptedArray.slice(0, dataLength);
            const authTag = encryptedArray.slice(dataLength);
            
            return {
                encrypted: this.arrayBufferToBase64(encrypted),
                iv: this.arrayBufferToBase64(iv),
                authTag: this.arrayBufferToBase64(authTag),
                sessionId: this.sessionId,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Client encryption failed:', error);
            throw error;
        }
    }

    // CORRECTED Client-side decryption
    async decryptData(encryptedData) {
        try {
            if (!this.cryptoKey) {
                throw new Error('Crypto not initialized');
            }

            const iv = this.base64ToArrayBuffer(encryptedData.iv);
            const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
            const authTag = this.base64ToArrayBuffer(encryptedData.authTag);
            
            // For Web Crypto API with AES-GCM, combine encrypted data and auth tag
            const combinedBuffer = new Uint8Array(encrypted.byteLength + authTag.byteLength);
            combinedBuffer.set(new Uint8Array(encrypted), 0);
            combinedBuffer.set(new Uint8Array(authTag), encrypted.byteLength);
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.cryptoKey,
                combinedBuffer
            );
            
            const decryptedText = new TextDecoder().decode(decryptedBuffer);
            return JSON.parse(decryptedText);
        } catch (error) {
            console.error('❌ Client decryption failed:', error);
            throw error;
        }
    }

    // CORRECTED utility functions
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Make encrypted API calls
    async makeEncryptedRequest(url, options = {}) {
        if (!this.sessionId) {
            throw new Error('Encryption not initialized');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-Session-ID': this.sessionId,
            ...options.headers
        };

        if (options.body && typeof options.body === 'object') {
            const encryptedBody = await this.encryptData(options.body);
            options.body = JSON.stringify(encryptedBody);
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            if (data.encrypted) {
                return await this.decryptData(data);
            }
            return data;
        }

        return response;
    }

    updateConnectionStatus(connected) {
        this.connectionStatus.className = `connection-status ${connected ? '' : 'disconnected'}`;
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        if (connected) {
            statusText.textContent = 'Connected 🔐 (...)';
        } else {
            statusText.textContent = 'Disconnected';
        }
    }

    updateClientCount(count) {
        const statusText = this.connectionStatus.querySelector('.status-text');
        const isConnected = !this.connectionStatus.classList.contains('disconnected');
        
        if (isConnected) {
            const clientText = count === 1 ? 'client' : 'clients';
            statusText.textContent = `Connected 🔐 (${count} ${clientText})`;
        }
    }

    updateClientsList(clients) {
        if (clients.length === 0) {
            this.clientsList.innerHTML = '<div class="empty-state">No clients connected</div>';
            return;
        }

        this.clientsList.innerHTML = clients.map(client => {
            const connectedTime = this.getTimeAgo(client.connectedAt);
            const deviceIcon = this.getDeviceIcon(client.device);
            const hasEncryption = client.sessionId ? '🔐' : '❌';
            
            return `
                <div class="client-item">
                    <div class="client-avatar">
                        ${deviceIcon}
                    </div>
                    <div class="client-info">
                        <div class="client-primary">
                            ${client.browser} on ${client.os} ${hasEncryption}
                        </div>
                        <div class="client-secondary">
                            ${client.ip} • ${client.device}
                        </div>
                    </div>
                    <div class="client-status">
                        <div class="client-connected-time">
                            ${connectedTime}
                        </div>
                        <div style="color: #48bb78;">● Online</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getDeviceIcon(device) {
        switch (device.toLowerCase()) {
            case 'mobile': return '📱';
            case 'tablet': return '📟';
            default: return '💻';
        }
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return time.toLocaleDateString();
    }

    toggleClientsPanel() {
        if (this.clientsPanel.style.display === 'none') {
            this.showClientsPanel();
        } else {
            this.hideClientsPanel();
        }
    }

    showClientsPanel() {
        this.clientsPanel.style.display = 'block';
        this.toggleClientsBtn.textContent = 'Hide Clients';
    }

    hideClientsPanel() {
        this.clientsPanel.style.display = 'none';
        this.toggleClientsBtn.textContent = 'Show Clients';
    }

    async addText() {
        const content = this.textInput.value.trim();
        if (!content) {
            alert('Please enter some text');
            return;
        }

        try {
            const result = await this.makeEncryptedRequest('/api/clipboard/text', {
                method: 'POST',
                body: { content }
            });

            if (result.success) {
                this.textInput.value = '';
                this.showNotification('Text added to clipboard! 🔐', 'success');
            } else {
                throw new Error('Failed to add text');
            }
        } catch (error) {
            console.error('Error adding text:', error);
            this.showNotification('Failed to add text', 'error');
        }
    }

    async uploadFiles() {
        const files = this.fileInput.files;
        if (files.length === 0) {
            alert('Please select files to upload');
            return;
        }

        for (let file of files) {
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/clipboard/file', {
                    method: 'POST',
                    headers: {
                        'X-Session-ID': this.sessionId
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                const result = await response.json();
                if (result.encrypted) {
                    await this.decryptData(result); // Decrypt response
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                this.showNotification(`Failed to upload ${file.name}`, 'error');
            }
        }

        this.fileInput.value = '';
        this.showNotification('Files uploaded to clipboard! 🔐', 'success');
    }

    async clearAll() {
        if (!confirm('Are you sure you want to clear all clipboard data?')) {
            return;
        }

        try {
            const result = await this.makeEncryptedRequest('/api/clipboard/clear', {
                method: 'DELETE',
                body: { confirm: true }
            });

            if (result.success) {
                this.showNotification('Clipboard cleared! 🔐', 'success');
            } else {
                throw new Error('Failed to clear clipboard');
            }
        } catch (error) {
            console.error('Error clearing clipboard:', error);
            this.showNotification('Failed to clear clipboard', 'error');
        }
    }

    updateDisplay(data) {
        this.displayTexts(data.texts);
        this.displayFiles(data.files);
    }

    displayTexts(texts) {
        if (texts.length === 0) {
            this.textList.innerHTML = '<div class="empty-state">No text items yet</div>';
            return;
        }

        this.textList.innerHTML = texts.map(text => `
            <div class="item" data-id="${text.id}">
                <div class="item-header">
                    <div class="item-time">${this.formatTime(text.timestamp)} 🔐</div>
                    <div class="item-actions">
                        <button class="btn-small btn-copy" onclick="clipboard.copyText('${text.id}')">Copy</button>
                        <button class="btn-small btn-delete" onclick="clipboard.deleteText('${text.id}')">Delete</button>
                    </div>
                </div>
                <div class="text-content">${this.escapeHtml(text.content)}</div>
            </div>
        `).join('');
    }

    displayFiles(files) {
        if (files.length === 0) {
            this.fileList.innerHTML = '<div class="empty-state">No files yet</div>';
            return;
        }

        this.fileList.innerHTML = files.map(file => `
            <div class="item" data-id="${file.id}">
                <div class="item-header">
                    <div class="item-time">${this.formatTime(file.timestamp)} 🔐</div>
                    <div class="item-actions">
                        <button class="btn-small btn-download" onclick="clipboard.downloadFile('${file.downloadUrl}', '${file.originalName}')">Download</button>
                        <button class="btn-small btn-delete" onclick="clipboard.deleteFile('${file.id}')">Delete</button>
                    </div>
                </div>
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.mimetype)}</div>
                    <div class="file-details">
                        <div class="file-name">${this.escapeHtml(file.originalName)}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async copyText(textId) {
        const textElement = document.querySelector(`[data-id="${textId}"] .text-content`);
        const text = textElement.textContent;

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Text copied to clipboard! 🔐', 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Text copied to clipboard! 🔐', 'success');
        }
    }

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async deleteText(textId) {
        if (!confirm('Delete this text?')) return;

        try {
            await this.makeEncryptedRequest(`/api/clipboard/text/${textId}`, {
                method: 'DELETE',
                body: { id: textId }
            });
            this.showNotification('Text deleted! 🔐', 'success');
        } catch (error) {
            this.showNotification('Failed to delete text', 'error');
        }
    }

    async deleteFile(fileId) {
        if (!confirm('Delete this file?')) return;

        try {
            await this.makeEncryptedRequest(`/api/clipboard/file/${fileId}`, {
                method: 'DELETE',
                body: { id: fileId }
            });
            this.showNotification('File deleted! 🔐', 'success');
        } catch (error) {
            this.showNotification('Failed to delete file', 'error');
        }
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(mimetype) {
        if (mimetype.startsWith('image/')) return '🖼️';
        if (mimetype.startsWith('video/')) return '🎥';
        if (mimetype.startsWith('audio/')) return '🎵';
        if (mimetype.includes('pdf')) return '📄';
        if (mimetype.includes('text/')) return '📝';
        if (mimetype.includes('zip') || mimetype.includes('rar')) return '🗜️';
        return '📄';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            background: ${type === 'success' ? '#48bb78' : '#f56565'};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

const clipboard = new LocalClipboard();
