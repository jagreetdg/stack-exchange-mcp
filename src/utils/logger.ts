// src/utils/logger.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class Logger {
    private context: string;
    private logFile: string;
    private initialized: boolean = false;

    constructor(context: string = 'App') {
        this.context = context;
        try {
            // Try project directory first
            let logsDir = path.join(process.cwd(), 'logs');
            
            // If we can't write to project directory, use temp directory
            if (!this.canWriteToDirectory(logsDir)) {
                logsDir = path.join(os.tmpdir(), 'stack-exchange-mcp', 'logs');
            }

            // Ensure directory exists
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            this.logFile = path.join(logsDir, 'stack-exchange-mcp-server.log');
            
            // Test if we can write to the log file
            this.debug('Logger initialized', {
                cwd: process.cwd(),
                user: process.env.USERNAME,
                env: process.env.NODE_ENV,
                pid: process.pid
            });
            
            this.initialized = true;
            this.info('Logger initialized successfully');
        } catch (error) {
            console.error('Failed to initialize logger:', error);
            // Set a fallback log file in temp directory
            this.logFile = path.join(os.tmpdir(), 'stack-exchange-mcp-error.log');
        }
    }

    private canWriteToDirectory(dir: string): boolean {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const testFile = path.join(dir, '.write-test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
            return true;
        } catch {
            return false;
        }
    }

    private formatMessage(level: string, message: string, data?: any): string {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            message,
            data
        };
        return `[DEBUG_INFO] ${JSON.stringify(debugInfo)}`;
    }

    private writeToFile(message: string, ...args: any[]): void {
        if (!this.initialized) {
            console.error('Logger not initialized, cannot write to file');
            return;
        }

        try {
            const logMessage = `${message} ${args.length ? JSON.stringify(args) : ''}\n`;
            fs.appendFileSync(this.logFile, logMessage);
        } catch (error) {
            console.error('Failed to write to log file:', error);
            // Try writing to stderr as fallback
            console.error(message, ...args);
        }
    }

    debug(message: string, data?: any): void {
        const formattedMessage = this.formatMessage('DEBUG', message, data);
        console.error(formattedMessage);
        this.writeToFile(formattedMessage);
    }

    info(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('INFO', message, args.length ? args : undefined);
        console.error(formattedMessage);
        this.writeToFile(formattedMessage);
    }

    error(message: string, error?: unknown): void {
        const errorData = error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
            : error;
        const formattedMessage = this.formatMessage('ERROR', message, errorData);
        console.error(formattedMessage);
        this.writeToFile(formattedMessage);
    }

    warn(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('WARN', message, args.length ? args : undefined);
        console.error(formattedMessage);
        this.writeToFile(formattedMessage);
    }
}