import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Emits one JSON line per log entry (level, timestamp, context, message) instead
 * of Nest's default colored/human-formatted output — needed so log aggregation
 * (Loki, per ADR-0014) can parse fields instead of scraping free text.
 *
 * This NestJS version's ConsoleLoggerOptions has no "disable colors" flag, and
 * the context string is pre-colorized by formatContext() *before*
 * formatMessage() ever runs (formatContext calls a yellow() ANSI helper
 * directly, not this.colorize()) — so formatContext must be overridden too,
 * not just colorize()/formatMessage().
 */
export class JsonLogger extends ConsoleLogger {
  protected formatContext(context: string): string {
    return context ? `[${context}] ` : '';
  }

  protected colorize(message: string, _logLevel: LogLevel): string {
    return message;
  }

  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    _pidMessage: string,
    _formattedLogLevel: string,
    contextMessage: string,
    _timestampDiff: string,
  ): string {
    const entry = {
      level: logLevel,
      timestamp: new Date().toISOString(),
      context: contextMessage?.trim().replace(/^\[|\]$/g, '') || undefined,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    return JSON.stringify(entry) + '\n';
  }
}
