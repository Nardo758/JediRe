"use strict";
/**
 * Global Error Handler
 * Catch and format errors consistently
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    message;
    isOperational;
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, next) {
    // Log error
    logger_1.logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
    });
    // Determine status code
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    // Determine if we should expose error details
    const isDevelopment = process.env.NODE_ENV === 'development';
    // Build error response
    const errorResponse = {
        error: err.name || 'Error',
        message: err.message || 'Internal server error',
        statusCode,
    };
    // Include stack trace in development
    if (isDevelopment) {
        errorResponse.stack = err.stack;
    }
    res.status(statusCode).json(errorResponse);
}
function notFoundHandler(req, res, next) {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
    });
}
//# sourceMappingURL=errorHandler.js.map