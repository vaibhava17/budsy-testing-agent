/**
 * Budsy Logger
 * Centralized logging for the testing agent
 */

import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/index.js';

class Logger {
  constructor() {
    this.logLevel = config.logging.level.toLowerCase();
    this.logFile = config.logging.file;
    this.enableConsole = config.logging.console;
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.colors = {
      error: chalk.red,
      warn: chalk.yellow,
      info: chalk.blue,
      debug: chalk.gray,
      success: chalk.green
    };

    this._ensureLogDir();
  }

  async _ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  _formatMessage(level, component, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;
    
    let formattedMessage = `${prefix} ${message}`;
    
    if (Object.keys(data).length > 0) {
      formattedMessage += ` | ${JSON.stringify(data)}`;
    }
    
    return formattedMessage;
  }

  async _writeToFile(message) {
    try {
      await fs.appendFile(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  _log(level, component, message, data = {}) {
    if (!this._shouldLog(level)) return;

    const formattedMessage = this._formatMessage(level, component, message, data);

    // Console output with colors
    if (this.enableConsole) {
      const colorFn = this.colors[level] || chalk.white;
      console.log(colorFn(formattedMessage));
    }

    // File output
    this._writeToFile(formattedMessage);
  }

  error(component, message, data = {}) {
    this._log('error', component, message, data);
  }

  warn(component, message, data = {}) {
    this._log('warn', component, message, data);
  }

  info(component, message, data = {}) {
    this._log('info', component, message, data);
  }

  debug(component, message, data = {}) {
    this._log('debug', component, message, data);
  }

  success(component, message, data = {}) {
    if (this.enableConsole) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [SUCCESS] [${component}]`;
      const formattedMessage = `${prefix} ${message}`;
      console.log(this.colors.success(formattedMessage));
    }
    this._log('info', component, `✓ ${message}`, data);
  }

  // Specialized logging methods
  testStart(testName, details = {}) {
    this.info('TEST', `Starting test: ${testName}`, details);
  }

  testEnd(testName, success, duration, details = {}) {
    const status = success ? '✓ PASSED' : '✗ FAILED';
    const message = `${status}: ${testName} (${duration}ms)`;
    
    if (success) {
      this.success('TEST', message, details);
    } else {
      this.error('TEST', message, details);
    }
  }

  stepStart(stepNumber, action, description) {
    this.info('STEP', `Step ${stepNumber}: ${action} - ${description}`);
  }

  stepEnd(stepNumber, success, duration, details = {}) {
    const status = success ? '✓' : '✗';
    const message = `Step ${stepNumber} ${status} (${duration}ms)`;
    
    if (success) {
      this.success('STEP', message, details);
    } else {
      this.error('STEP', message, details);
    }
  }

  aiRequest(endpoint, requestData = {}) {
    this.debug('AI', `Request to ${endpoint}`, { 
      instruction: requestData.instruction?.substring(0, 100) + '...',
      hasScreenshot: !!requestData.screenshot_base64
    });
  }

  aiResponse(endpoint, success, responseData = {}) {
    if (success) {
      this.info('AI', `Response from ${endpoint}`, {
        success: responseData.success,
        confidence: responseData.confidence,
        result: responseData.result?.substring(0, 100) + '...'
      });
    } else {
      this.error('AI', `Failed response from ${endpoint}`, responseData);
    }
  }

  screenshot(filename, action) {
    this.debug('SCREENSHOT', `${action}: ${filename}`);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;