class LocalClipboard {
    constructor() {
        this.socket = io();
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
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
    }

    setupEventListeners() {
        this.addTextBtn.addEventListener('click', () => this.addText());
        this.uploadFileBtn.addEventListener('click', () => this.uploadFiles());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        
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

        this.socket.on('clipboardUpdate', (data) => {
            this.updateDisplay(data);
        });
    }

    updateConnectionStatus(connected) {
        this.connectionStatus.className = `connection-status ${connected ? '' : 'disconnected'}`;
        this.connectionStatus.querySelector('.status-text').textContent = connected ? 'Connected' : 'Disconnected';
    }

    async addText() {
        const content = this.textInput.value.trim();
        if (!content) {
            alert('Please enter some text');
            return;
        }

        try {
            const response = await fetch('/api/clipboard/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            if (response.ok) {
                this.textInput.value = '';
                this.showNotification('Text added to clipboard!', 'success');
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
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                this.showNotification(`Failed to upload ${file.name}`, 'error');
            }
        }

        this.fileInput.value = '';
        this.showNotification('Files uploaded to clipboard!', 'success');
    }

    async clearAll() {
        if (!confirm('Are you sure you want to clear all clipboard data?')) {
            return;
        }

        try {
            const response = await fetch('/api/clipboard/clear', {
                method: 'DELETE',
            });

            if (response.ok) {
                this.showNotification('Clipboard cleared!', 'success');
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
                    <div class="item-time">${this.formatTime(text.timestamp)}</div>
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
                    <div class="item-time">${this.formatTime(file.timestamp)}</div>
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
            this.showNotification('Text copied to clipboard!', 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Text copied to clipboard!', 'success');
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
            await fetch(`/api/clipboard/text/${textId}`, { method: 'DELETE' });
            this.showNotification('Text deleted!', 'success');
        } catch (error) {
            this.showNotification('Failed to delete text', 'error');
        }
    }

    async deleteFile(fileId) {
        if (!confirm('Delete this file?')) return;

        try {
            await fetch(`/api/clipboard/file/${fileId}`, { method: 'DELETE' });
            this.showNotification('File deleted!', 'success');
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
