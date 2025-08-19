const { executeQuery, logger } = require('../config/database');
const Joi = require('joi');

class ClipboardModel {
    // Validation schemas
    static textSchema = Joi.object({
        content: Joi.string().required().min(1).max(50000)
    });

    static fileSchema = Joi.object({
        original_name: Joi.string().required().max(255),
        filename: Joi.string().required().max(255),
        file_size: Joi.number().integer().min(0).max(52428800),
        mimetype: Joi.string().required().max(100),
        download_url: Joi.string().required().max(500)
    });

    // Get all clipboard data
    static async getAllData() {
        try {
            const textsQuery = `
                SELECT id, content, timestamp 
                FROM clipboard_texts 
                ORDER BY timestamp DESC 
                LIMIT 50
            `;
            
            const filesQuery = `
                SELECT id, original_name, filename, file_size, mimetype, download_url, timestamp 
                FROM clipboard_files 
                ORDER BY timestamp DESC 
                LIMIT 20
            `;

            const [textsResult, filesResult] = await Promise.all([
                executeQuery(textsQuery),
                executeQuery(filesQuery)
            ]);

            if (!textsResult.success || !filesResult.success) {
                throw new Error('Failed to fetch clipboard data');
            }

            return {
                success: true,
                data: {
                    texts: textsResult.data.map(text => ({
                        ...text,
                        type: 'text',
                        timestamp: text.timestamp.toISOString()
                    })),
                    files: filesResult.data.map(file => ({
                        ...file,
                        type: 'file',
                        size: file.file_size,
                        originalName: file.original_name,
                        timestamp: file.timestamp.toISOString()
                    }))
                }
            };
        } catch (error) {
            logger.error('Error getting all clipboard data:', error);
            return { success: false, error: error.message };
        }
    }

    // Add text entry
    static async addText(content) {
        try {
            // Validate input
            const { error } = this.textSchema.validate({ content });
            if (error) {
                return { success: false, error: error.details[0].message };
            }

            // Insert new text
            const insertQuery = `
                INSERT INTO clipboard_texts (content, timestamp) 
                VALUES (?, NOW())
            `;
            
            const result = await executeQuery(insertQuery, [content]);
            
            if (!result.success) {
                return result;
            }

            // Get the inserted record
            const selectQuery = `
                SELECT id, content, timestamp 
                FROM clipboard_texts 
                WHERE id = ?
            `;
            
            const selectResult = await executeQuery(selectQuery, [result.data.insertId]);
            
            if (!selectResult.success) {
                return selectResult;
            }

            // Clean up old entries (keep only last 50)
            const cleanupQuery = `
                DELETE FROM clipboard_texts 
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM clipboard_texts 
                        ORDER BY timestamp DESC 
                        LIMIT 50
                    ) as temp
                )
            `;
            
            await executeQuery(cleanupQuery);

            const textEntry = selectResult.data[0];
            return {
                success: true,
                data: {
                    ...textEntry,
                    type: 'text',
                    timestamp: textEntry.timestamp.toISOString()
                }
            };
        } catch (error) {
            logger.error('Error adding text:', error);
            return { success: false, error: error.message };
        }
    }

    // Add file entry
    static async addFile(fileData) {
        try {
            // Validate input
            const { error } = this.fileSchema.validate(fileData);
            if (error) {
                return { success: false, error: error.details[0].message };
            }

            // Insert new file
            const insertQuery = `
                INSERT INTO clipboard_files 
                (original_name, filename, file_size, mimetype, download_url, timestamp) 
                VALUES (?, ?, ?, ?, ?, NOW())
            `;
            
            const params = [
                fileData.original_name,
                fileData.filename,
                fileData.file_size,
                fileData.mimetype,
                fileData.download_url
            ];
            
            const result = await executeQuery(insertQuery, params);
            
            if (!result.success) {
                return result;
            }

            // Get the inserted record
            const selectQuery = `
                SELECT id, original_name, filename, file_size, mimetype, download_url, timestamp 
                FROM clipboard_files 
                WHERE id = ?
            `;
            
            const selectResult = await executeQuery(selectQuery, [result.data.insertId]);
            
            if (!selectResult.success) {
                return selectResult;
            }

            // Clean up old entries (keep only last 20)
            const cleanupQuery = `
                DELETE FROM clipboard_files 
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM clipboard_files 
                        ORDER BY timestamp DESC 
                        LIMIT 20
                    ) as temp
                )
            `;
            
            await executeQuery(cleanupQuery);

            const fileEntry = selectResult.data[0];
            return {
                success: true,
                data: {
                    ...fileEntry,
                    type: 'file',
                    size: fileEntry.file_size,
                    originalName: fileEntry.original_name,
                    timestamp: fileEntry.timestamp.toISOString()
                }
            };
        } catch (error) {
            logger.error('Error adding file:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete text entry
    static async deleteText(id) {
        try {
            const query = 'DELETE FROM clipboard_texts WHERE id = ?';
            const result = await executeQuery(query, [id]);
            return result;
        } catch (error) {
            logger.error('Error deleting text:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete file entry
    static async deleteFile(id) {
        try {
            // First get file info for cleanup
            const selectQuery = 'SELECT filename FROM clipboard_files WHERE id = ?';
            const selectResult = await executeQuery(selectQuery, [id]);
            
            if (!selectResult.success || selectResult.data.length === 0) {
                return { success: false, error: 'File not found' };
            }

            const deleteQuery = 'DELETE FROM clipboard_files WHERE id = ?';
            const result = await executeQuery(deleteQuery, [id]);
            
            if (result.success) {
                result.filename = selectResult.data[0].filename;
            }
            
            return result;
        } catch (error) {
            logger.error('Error deleting file:', error);
            return { success: false, error: error.message };
        }
    }

    // Clear all data
    static async clearAll() {
        try {
            // Get all filenames for cleanup
            const selectQuery = 'SELECT filename FROM clipboard_files';
            const selectResult = await executeQuery(selectQuery);
            
            const filenames = selectResult.success ? 
                selectResult.data.map(file => file.filename) : [];

            // Delete all entries
            const deleteTextsQuery = 'DELETE FROM clipboard_texts';
            const deleteFilesQuery = 'DELETE FROM clipboard_files';
            
            const [textsResult, filesResult] = await Promise.all([
                executeQuery(deleteTextsQuery),
                executeQuery(deleteFilesQuery)
            ]);

            if (!textsResult.success || !filesResult.success) {
                throw new Error('Failed to clear clipboard data');
            }

            return { success: true, filenames };
        } catch (error) {
            logger.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    }

    // Get settings
    static async getSettings() {
        try {
            const query = 'SELECT setting_key, setting_value FROM clipboard_settings';
            const result = await executeQuery(query);
            
            if (!result.success) {
                return result;
            }

            const settings = {};
            result.data.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });

            return { success: true, data: settings };
        } catch (error) {
            logger.error('Error getting settings:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ClipboardModel;
