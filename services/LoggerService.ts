
export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    category: 'SYSTEM' | 'UPLOAD' | 'AI_ENGINE' | 'EXPORT' | 'USER_ACTION';
    message: string;
    details?: any;
}

const STORAGE_KEY = 'PHOTOAUDIT_LOGS';

class LoggerService {
    private logs: LogEntry[] = [];

    constructor() {
        this.loadLogs();
    }

    private loadLogs() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load logs", e);
        }
    }

    private persist() {
        try {
            // Keep last 1000 logs to prevent overflow
            if (this.logs.length > 1000) {
                this.logs = this.logs.slice(0, 1000);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch (e) {
            console.error("Failed to persist logs", e);
        }
    }

    log(level: LogEntry['level'], category: LogEntry['category'], message: string, details?: any) {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            category,
            message,
            details
        };
        this.logs.unshift(entry); // Newest first
        this.persist();

        // Console Shim
        const prefix = `[${category}] ${level}:`;
        if (level === 'ERROR') console.error(prefix, message, details);
        else if (level === 'WARN') console.warn(prefix, message, details);
        else console.log(prefix, message, details);

        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('PHOTOAUDIT_LOG_UPDATE'));
    }

    info(category: LogEntry['category'], message: string, details?: any) {
        this.log('INFO', category, message, details);
    }

    success(category: LogEntry['category'], message: string, details?: any) {
        this.log('SUCCESS', category, message, details);
    }

    warn(category: LogEntry['category'], message: string, details?: any) {
        this.log('WARN', category, message, details);
    }

    error(category: LogEntry['category'], message: string, details?: any) {
        this.log('ERROR', category, message, details);
    }

    getLogs(): LogEntry[] {
        return this.logs;
    }

    clear() {
        this.logs = [];
        this.persist();
        window.dispatchEvent(new CustomEvent('PHOTOAUDIT_LOG_UPDATE'));
    }
}

export const logger = new LoggerService();
