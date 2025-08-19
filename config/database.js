const mysql = require('mysql2/promise');
const winston = require('winston');
require('dotenv').config();

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'local_clipboard',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
    timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
    reconnect: true,
    charset: 'utf8mb4'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        logger.info('Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        logger.error('Database connection failed:', error);
        return false;
    }
}

// Execute query with error handling
async function executeQuery(query, params = []) {
    try {
        const [results] = await pool.execute(query, params);
        return { success: true, data: results };
    } catch (error) {
        logger.error('Database query error:', { query, params, error: error.message });
        return { success: false, error: error.message };
    }
}

// Get database statistics
async function getDatabaseStats() {
    try {
        const textCountQuery = 'SELECT COUNT(*) as count FROM clipboard_texts';
        const fileCountQuery = 'SELECT COUNT(*) as count FROM clipboard_files';
        
        const [textResult] = await pool.execute(textCountQuery);
        const [fileResult] = await pool.execute(fileCountQuery);
        
        return {
            textCount: textResult[0].count,
            fileCount: fileResult[0].count
        };
    } catch (error) {
        logger.error('Error getting database stats:', error);
        return { textCount: 0, fileCount: 0 };
    }
}

module.exports = {
    pool,
    executeQuery,
    testConnection,
    getDatabaseStats,
    logger
};
