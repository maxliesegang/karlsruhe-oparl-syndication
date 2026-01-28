import axios from 'axios';
import util from 'node:util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const RESET_COLOR = '\x1b[0m';
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const shouldLog = (level: LogLevel): boolean => LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];

const formatMessage = (level: LogLevel, message: string, details: unknown[]): string => {
  const timestamp = new Date().toISOString();
  const levelTag = level.toUpperCase().padEnd(5, ' ');
  const color = LEVEL_COLORS[level];
  const base = `[${timestamp}] [${levelTag}] ${message}`;

  if (!details.length) {
    return `${color}${base}${RESET_COLOR}`;
  }

  const renderedDetails = details
    .map((detail) => formatDetail(detail, level))
    .filter(Boolean)
    .join(' | ');

  return `${color}${base}${RESET_COLOR}${renderedDetails ? ` — ${renderedDetails}` : ''}`;
};

const formatDetail = (detail: unknown, level: LogLevel): string => {
  if (!detail) return '';

  if (axios.isAxiosError(detail)) {
    const method = detail.config?.method?.toUpperCase();
    const url = detail.config?.url;
    const status = detail.response?.status ?? detail.code ?? 'ERR';
    const statusText = detail.response?.statusText ?? '';
    return `AxiosError ${status}${statusText ? ` ${statusText}` : ''}${url ? ` — ${method || 'GET'} ${url}` : ''}`;
  }

  if (detail instanceof Error) {
    return level === 'debug' ? detail.stack || detail.message : detail.message;
  }

  if (typeof detail === 'object') {
    return util.inspect(detail, { depth: 3, breakLength: 100, maxArrayLength: 10 });
  }

  return String(detail);
};

const log = (level: LogLevel, message: string, ...details: unknown[]): void => {
  if (!shouldLog(level)) return;

  const formatted = formatMessage(level, message, details);
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(formatted);
};

export const logger = {
  debug(message: string, ...details: unknown[]): void {
    log('debug', message, ...details);
  },

  info(message: string, ...details: unknown[]): void {
    log('info', message, ...details);
  },

  warn(message: string, ...details: unknown[]): void {
    log('warn', message, ...details);
  },

  error(message: string, ...details: unknown[]): void {
    log('error', message, ...details);
  },
};
