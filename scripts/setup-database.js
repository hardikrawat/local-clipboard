const mysql = require('mysql2/promise');
require('dotenv').config();

const setupDatabase = async () => {
    let connection;
    
    try {
        // Connect to MySQL server (without specific database)
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('Connected to MySQL server');

        // Create database if not exists
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'local_clipboard'}`);
        console.log(`Database '${process.env.DB_NAME || 'local_clipboard'}' created/verified`);

        // Use the database
        await connection.execute(`USE ${process.env.DB_NAME || 'local_clipboard'}`);

        // Create tables
        const createTablesSQL = `
            CREATE TABLE IF NOT EXISTS clipboard_texts (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_timestamp (timestamp),
                INDEX idx_created_at (created_at)
            );

            CREATE TABLE IF NOT EXISTS clipboard_files (
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

            CREATE TABLE IF NOT EXISTS clipboard_settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `;

        const statements = createTablesSQL.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                await connection.execute(statement);
            }
        }

        console.log('Tables created successfully');

        // Insert default settings
        const settingsSQL = `
            INSERT IGNORE INTO clipboard_settings (setting_key, setting_value) VALUES 
            ('max_text_entries', '50'),
            ('max_file_entries', '20'),
            ('max_file_size', '52428800')
        `;

        await connection.execute(settingsSQL);
        console.log('Default settings inserted');

        console.log('✅ Database setup completed successfully!');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

setupDatabase();
