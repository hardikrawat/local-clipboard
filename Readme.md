# Local Clipboard - Professional README

Here's a comprehensive and professional README file for your Local Clipboard project:

```markdown
# 🔗 Local Clipboard

A powerful, self-hosted clipboard sharing solution that enables seamless text and file sharing across multiple devices on your local network. Built with Node.js, Express, Socket.IO, and MySQL for real-time synchronization and persistent storage.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![MySQL](https://img.shields.io/badge/mysql-%3E%3D5.7-orange.svg)

## 📋 Table of Contents

- [Features](#-features)
- [Demo](#-demo)
- [Requirements](#-requirements)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [File Structure](#-file-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

## ✨ Features

### Core Functionality
- **📝 Text Sharing**: Copy and paste text content across devices with rich formatting support
- **📁 File Sharing**: Upload and download files up to 50MB per file
- **🔄 Real-time Sync**: Instant updates across all connected devices using WebSocket
- **💾 Persistent Storage**: MySQL database ensures data persistence across server restarts
- **📱 Cross-Platform**: Access from any device with a web browser

### Technical Features
- **🚀 High Performance**: Connection pooling and optimized database queries
- **🔒 Input Validation**: Comprehensive validation using Joi schema validation
- **📊 Logging**: Professional logging with Winston for monitoring and debugging
- **🏥 Health Monitoring**: Built-in health check endpoints for system monitoring
- **🔧 Environment Configuration**: Flexible configuration via environment variables
- **♻️ Auto Cleanup**: Automatic cleanup of old entries (configurable limits)

### User Experience
- **🎨 Modern UI**: Clean, responsive design that works on mobile and desktop
- **⚡ Fast Access**: One-click copy to clipboard functionality
- **🗂️ File Management**: Visual file type recognition with icons
- **📈 Usage Statistics**: Track clipboard usage and storage statistics
- **🔔 Real-time Notifications**: Visual feedback for all operations

## 🎥 Demo

![Local Clipboard Demo](docs/demo.gif)

*Access your clipboard from multiple devices simultaneously with real-time synchronization*

## 🛠️ Requirements

### System Requirements
- **Node.js** >= 14.0.0
- **MySQL** >= 5.7 or **MariaDB** >= 10.2
- **RAM**: Minimum 512MB (1GB recommended)
- **Storage**: 1GB available space
- **Network**: Local network access

### Supported Platforms
- **Server**: Linux, macOS, Windows
- **Clients**: Any device with a modern web browser
  - Chrome 70+
  - Firefox 65+
  - Safari 12+
  - Edge 79+

## 🚀 Quick Start

```
# Clone the repository
git clone https://github.com/yourusername/local-clipboard.git
cd local-clipboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit database credentials

# Setup database
npm run setup-db

# Start the server
npm start
```

Access your clipboard at `http://localhost:3000` or `http://YOUR_LOCAL_IP:3000`

## 📦 Installation

### Method 1: Standard Installation

1. **Clone the Repository**
   ```
   git clone https://github.com/yourusername/local-clipboard.git
   cd local-clipboard
   ```

2. **Install Dependencies**
   ```
   npm install
   ```

3. **Database Setup**
   
   **Option A: Using MySQL**
   ```
   # Install MySQL (Ubuntu/Debian)
   sudo apt update
   sudo apt install mysql-server
   
   # Install MySQL (macOS with Homebrew)
   brew install mysql
   brew services start mysql
   
   # Install MySQL (Windows)
   # Download from https://dev.mysql.com/downloads/installer/
   ```
   
   **Option B: Using Docker**
   ```
   docker run --name mysql-clipboard \
     -e MYSQL_ROOT_PASSWORD=your_password \
     -p 3306:3306 -d mysql:8.0
   ```

4. **Environment Configuration**
   ```
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=local_clipboard
   ```

5. **Initialize Database**
   ```
   npm run setup-db
   ```

6. **Start the Application**
   ```
   npm start
   ```

### Method 2: One-Command Setup

Run our automated setup script:

```
curl -fsSL https://raw.githubusercontent.com/yourusername/local-clipboard/main/install.sh | bash
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | MySQL server hostname |
| `DB_PORT` | `3306` | MySQL server port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | `` | MySQL password |
| `DB_NAME` | `local_clipboard` | Database name |
| `PORT` | `3000` | Application port |
| `NODE_ENV` | `development` | Environment mode |
| `MAX_FILE_SIZE` | `52428800` | Maximum file size (50MB) |
| `UPLOAD_DIR` | `uploads` | File upload directory |
| `DB_CONNECTION_LIMIT` | `10` | Database connection pool limit |

### Advanced Configuration

#### Text Limits
- **Current**: 50,000 characters per text entry
- **Maximum**: 16MB with `MEDIUMTEXT` (requires database migration)

#### File Limits
- **Size**: 50MB per file (configurable)
- **Types**: All file types supported
- **Storage**: 20 most recent files retained

#### Database Optimization
```
-- Optimize for better performance
ALTER TABLE clipboard_texts ADD INDEX idx_content_length ((LENGTH(content)));
ALTER TABLE clipboard_files ADD INDEX idx_file_size (file_size);
```

## 📖 Usage

### Web Interface

1. **Adding Text**
   - Type or paste text in the textarea
   - Click "Add Text" or press `Ctrl+Enter`
   - Text appears in the clipboard instantly

2. **Uploading Files**
   - Click "Choose Files" or drag & drop
   - Select one or multiple files
   - Files upload automatically

3. **Using Content**
   - **Text**: Click "Copy" to copy to device clipboard
   - **Files**: Click "Download" to download to device

4. **Management**
   - Delete individual items with the delete button
   - Clear all content with "Clear All"
   - Real-time updates across all connected devices

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Add text to clipboard |
| `Ctrl+Shift+C` | Clear all content |
| `Esc` | Close modals/notifications |

## 🔌 API Documentation

### REST Endpoints

#### Get Clipboard Data
```
GET /api/clipboard
```
**Response:**
```
{
  "texts": [...],
  "files": [...]
}
```

#### Add Text
```
POST /api/clipboard/text
Content-Type: application/json

{
  "content": "Your text content here"
}
```

#### Upload File
```
POST /api/clipboard/file
Content-Type: multipart/form-data

file: [binary file data]
```

#### Delete Text Entry
```
DELETE /api/clipboard/text/:id
```

#### Delete File Entry
```
DELETE /api/clipboard/file/:id
```

#### Clear All Data
```
DELETE /api/clipboard/clear
```

#### Health Check
```
GET /health
```
**Response:**
```
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-08-19T10:30:00.000Z"
}
```

### WebSocket Events

#### Client → Server
- `connection`: Initial connection
- `disconnect`: Client disconnects

#### Server → Client
- `clipboardUpdate`: Broadcast clipboard changes

### Error Responses

```
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-19T10:30:00.000Z"
}
```

## 🗄️ Database Schema

### Tables

#### `clipboard_texts`
```
CREATE TABLE clipboard_texts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_created_at (created_at)
);
```

#### `clipboard_files`
```
CREATE TABLE clipboard_files (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    download_url VARCHAR(500) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp),
    INDEX idx_created_at (created_at),
    INDEX idx_filename (filename)
);
```

#### `clipboard_settings`
```
CREATE TABLE clipboard_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Database Migrations

#### Increase Text Limit
```
node scripts/increase-text-limit.js
```

#### Migrate from File Storage
```
npm run migrate
```

## 📁 File Structure

```
local-clipboard/
├── 📄 README.md                 # This file
├── 📄 package.json             # Node.js dependencies
├── 📄 .env                     # Environment configuration
├── 📄 .env.example             # Environment template
├── 📄 server.js                # Main server file
├── 📁 config/
│   └── 📄 database.js          # Database configuration
├── 📁 models/
│   └── 📄 ClipboardModel.js    # Data access layer
├── 📁 scripts/
│   ├── 📄 setup-database.js    # Database setup
│   ├── 📄 migrate-data.js      # Data migration
│   └── 📄 increase-text-limit.js # Text limit modification
├── 📁 public/
│   ├── 📄 index.html           # Frontend HTML
│   ├── 📄 styles.css           # Frontend styles
│   └── 📄 app.js               # Frontend JavaScript
├── 📁 logs/                    # Application logs
├── 📁 uploads/                 # File storage
├── 📁 docs/                    # Documentation
└── 📁 tests/                   # Test files
```

## 🔧 Development

### Prerequisites
- Node.js 14+ and npm
- MySQL 5.7+ or MariaDB 10.2+
- Git

### Setup Development Environment

1. **Clone and Install**
   ```
   git clone https://github.com/yourusername/local-clipboard.git
   cd local-clipboard
   npm install
   ```

2. **Setup Database**
   ```
   npm run setup-db
   ```

3. **Run in Development Mode**
   ```
   npm run dev
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-reload |
| `npm run setup-db` | Initialize database schema |
| `npm run migrate` | Migrate existing file data to database |
| `npm test` | Run test suite |
| `npm run lint` | Run code linting |
| `npm run build` | Build for production |

### Code Style

We use ESLint and Prettier for code formatting:

```
npm run lint        # Check code style
npm run lint:fix    # Auto-fix style issues
npm run format      # Format code with Prettier
```

### Testing

```
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Deployment

#### Method 1: Traditional Server

1. **Server Setup**
   ```
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nodejs npm mysql-server nginx
   
   # Configure MySQL
   sudo mysql_secure_installation
   ```

2. **Application Deployment**
   ```
   # Clone and setup
   git clone https://github.com/yourusername/local-clipboard.git
   cd local-clipboard
   npm ci --production
   
   # Configure environment
   cp .env.example .env
   nano .env  # Configure for production
   
   # Setup database
   npm run setup-db
   ```

3. **Process Management**
   ```
   # Install PM2
   npm install -g pm2
   
   # Start application
   pm2 start server.js --name "local-clipboard"
   pm2 startup
   pm2 save
   ```

4. **Nginx Configuration**
   ```
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

#### Method 2: Docker Deployment

1. **Create Dockerfile**
   ```
   FROM node:16-alpine
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   
   COPY . .
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```

2. **Docker Compose**
   ```
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - DB_HOST=mysql
         - DB_USER=clipboard
         - DB_PASSWORD=secure_password
         - DB_NAME=local_clipboard
       depends_on:
         - mysql
       volumes:
         - ./uploads:/app/uploads
   
     mysql:
       image: mysql:8.0
       environment:
         - MYSQL_ROOT_PASSWORD=root_password
         - MYSQL_DATABASE=local_clipboard
         - MYSQL_USER=clipboard
         - MYSQL_PASSWORD=secure_password
       volumes:
         - mysql_data:/var/lib/mysql
   
   volumes:
     mysql_data:
   ```

3. **Deploy**
   ```
   docker-compose up -d
   ```

### Environment-Specific Configurations

#### Development
```
NODE_ENV=development
DB_HOST=localhost
PORT=3000
```

#### Production
```
NODE_ENV=production
DB_HOST=your-mysql-server
PORT=3000
DB_CONNECTION_LIMIT=20
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Failed
```
# Check MySQL service
sudo systemctl status mysql
sudo systemctl start mysql

# Test connection
mysql -u root -p -h localhost

# Check credentials in .env file
```

#### Port Already in Use
```
# Find process using port 3000
lsof -i :3000
kill -9 

# Or use different port
PORT=3001 npm start
```

#### File Upload Issues
```
# Check upload directory permissions
chmod 755 uploads/
chown -R www-data:www-data uploads/

# Check disk space
df -h
```

#### Memory Issues
```
# Check memory usage
free -h

# Increase Node.js memory limit
node --max-old-space-size=4096 server.js
```

### Debugging

#### Enable Debug Logging
```
NODE_ENV=development
DEBUG=clipboard:*
```

#### Database Query Debugging
```
// Add to config/database.js
const pool = mysql.createPool({
    ...dbConfig,
    debug: true  // Enable query logging
});
```

#### Client-Side Debugging
Open browser console and check for errors in:
- Network requests
- WebSocket connections
- JavaScript errors

### Performance Optimization

#### Database Optimization
```
-- Add indexes for better performance
CREATE INDEX idx_content_search ON clipboard_texts (content(100));
CREATE INDEX idx_filename_search ON clipboard_files (original_name);

-- Optimize tables
OPTIMIZE TABLE clipboard_texts;
OPTIMIZE TABLE clipboard_files;
```

#### Application Optimization
```
// Increase connection pool size
DB_CONNECTION_LIMIT=20

// Enable gzip compression
app.use(compression());

// Add caching headers
app.use(express.static('public', {
    maxAge: '1d'
}));
```

### Log Analysis

#### Application Logs
```
# View real-time logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Search for specific errors
grep "Database" logs/combined.log
```

#### System Logs
```
# MySQL logs
sudo tail -f /var/log/mysql/error.log

# System logs
journalctl -u mysql.service -f
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. **Fork the Repository**
   ```
   git clone https://github.com/yourusername/local-clipboard.git
   cd local-clipboard
   git remote add upstream https://github.com/original/local-clipboard.git
   ```

2. **Create Feature Branch**
   ```
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests for new features

4. **Test Your Changes**
   ```
   npm test
   npm run lint
   ```

5. **Submit Pull Request**
   - Clear description of changes
   - Link related issues
   - Update documentation if needed

### Development Guidelines

#### Code Style
- Use ESLint configuration
- Follow consistent naming conventions
- Comment complex logic
- Write meaningful commit messages

#### Testing
- Write unit tests for new functions
- Add integration tests for API endpoints
- Ensure all tests pass before submitting

#### Documentation
- Update README for new features
- Add inline code comments
- Update API documentation

### Issue Reporting

When reporting bugs, please include:
- Operating system and version
- Node.js and MySQL versions
- Steps to reproduce
- Expected vs actual behavior
- Error messages and logs

### Feature Requests

For feature requests:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Willingness to contribute code

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Local Clipboard Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 💬 Support

### Community Support
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/yourusername/local-clipboard/discussions)
- **GitHub Issues**: [Report bugs and request features](https://github.com/yourusername/local-clipboard/issues)

### Documentation
- **Wiki**: [Detailed guides and tutorials](https://github.com/yourusername/local-clipboard/wiki)
- **FAQ**: [Frequently Asked Questions](docs/FAQ.md)
- **Troubleshooting**: [Common issues and solutions](docs/TROUBLESHOOTING.md)

### Professional Support
For enterprise support and custom implementations, please contact: support@yourcompany.com

---

## 🌟 Acknowledgments

- **Express.js** - Fast, unopinionated web framework
- **Socket.IO** - Real-time bidirectional communication
- **MySQL** - Reliable relational database
- **Winston** - Professional logging library
- **Joi** - Data validation library
- **Multer** - File upload handling

---

**Made with ❤️ for developers who need seamless clipboard sharing across devices by Hardik Rawat.**

---

*If you find this project useful, please consider giving it a ⭐ star on GitHub!*
```