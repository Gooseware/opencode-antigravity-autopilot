import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

export class AutopilotLogger {
  private logFilePath: string;
  private enabled: boolean;
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options?: {
    logDir?: string;
    filename?: string;
    enabled?: boolean;
    minLevel?: LogLevel;
  }) {
    const logDir = options?.logDir || '/tmp';
    const filename = options?.filename || `autopilot-${this.getDateString()}.log`;
    this.logFilePath = path.join(logDir, filename);
    this.enabled = options?.enabled ?? true;
    this.minLevel = options?.minLevel || 'info';

    if (this.enabled) {
      this.ensureLogDirectory();
      this.logRotation();
    }
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private logRotation(): void {
    try {
      const dir = path.dirname(this.logFilePath);
      const files = fs.readdirSync(dir);
      const autopilotLogs = files.filter(f => f.startsWith('autopilot-') && f.endsWith('.log'));

      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      for (const file of autopilotLogs) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < sevenDaysAgo) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {

    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private formatLogEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] ${entry.message}${dataStr}\n`;
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    try {
      const formatted = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFilePath, formatted, 'utf-8');
    } catch (error) {
      // Silently fail - don't use console
    }
  }

  debug(component: string, message: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'debug',
      component,
      message,
      data,
    });
  }

  info(component: string, message: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      component,
      message,
      data,
    });
  }

  warn(component: string, message: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      component,
      message,
      data,
    });
  }

  error(component: string, message: string, data?: any): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      message,
      data,
    });
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

let globalLogger: AutopilotLogger | null = null;

export function getLogger(options?: { logDir?: string; filename?: string; enabled?: boolean; minLevel?: LogLevel }): AutopilotLogger {
  if (!globalLogger) {
    globalLogger = new AutopilotLogger(options);
  }
  return globalLogger;
}

export function setLogger(logger: AutopilotLogger): void {
  globalLogger = logger;
}
