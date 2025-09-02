/**
 * Budsy Configuration
 * Central configuration management for the testing agent
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Backend LLM Service
  backend: {
    url: process.env.BACKEND_URL || 'http://localhost:8000',
    authKey: process.env.API_AUTH_KEY || '',
    endpoints: {
      uiVerification: '/llm/ui-verification/verify',
      generateSteps: '/llm/ui-verification/generate-steps',
      visualAction: '/llm/ui-verification/visual-action',
      startSession: '/llm/ui-verification/start-session',
      iterativeFeedback: '/llm/ui-verification/iterative-feedback'
    }
  },

  // Appium Configuration
  appium: {
    serverUrl: process.env.APPIUM_SERVER_URL || 'http://localhost:4723',
    logLevel: process.env.APPIUM_LOG_LEVEL || 'info',
    
    // Web testing capabilities
    webCapabilities: {
      platformName: 'Desktop',
      browserName: process.env.DEFAULT_BROWSER || 'chrome',
      'appium:automationName': (process.env.DEFAULT_BROWSER || 'chrome') === 'firefox' ? 'Gecko' : 'Chromium',
      'appium:newCommandTimeout': 300,
      'goog:chromeOptions': {
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          `--window-size=${process.env.BROWSER_WINDOW_WIDTH || 1280},${process.env.BROWSER_WINDOW_HEIGHT || 720}`
        ]
      }
    },

    // Mobile testing capabilities (Android)
    androidCapabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:newCommandTimeout': 300
    },

    // Mobile testing capabilities (iOS)
    iosCapabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:newCommandTimeout': 300
    }
  },

  // Screenshot Configuration
  screenshots: {
    dir: process.env.SCREENSHOT_DIR || './screenshots',
    save: process.env.SAVE_SCREENSHOTS === 'true',
    quality: 90,
    format: 'png'
  },

  // Test Configuration
  testing: {
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT) || 10000,
    stepDelay: parseInt(process.env.STEP_DELAY) || 1000,
    retryAttempts: 3,
    waitForElementTimeout: 5000
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/budsy.log',
    console: true
  },

  // Paths
  paths: {
    root: path.resolve(__dirname, '../..'),
    screenshots: path.resolve(__dirname, '../../screenshots'),
    logs: path.resolve(__dirname, '../../logs'),
    examples: path.resolve(__dirname, '../examples')
  }
};

export default config;