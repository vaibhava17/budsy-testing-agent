/**
 * Appium Driver Manager for Budsy
 * Handles Appium WebDriver initialization and screenshot capabilities
 */

import { remote } from 'webdriverio';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import logger from './logger.js';

class AppiumDriverManager {
  constructor() {
    this.driver = null;
    this.sessionId = null;
    this.screenshotCounter = 0;
    this.actionLogs = []; // Store detailed action execution logs
    this.sessionContext = {}; // Store session-wide context
  }

  /**
   * Initialize driver for web testing
   * Uses direct WebDriverIO for web testing or Appium for mobile
   * @param {object} options - Driver options
   * @returns {Promise<void>}
   */
  async initWebDriver(options = {}) {
    logger.info('DRIVER', 'Initializing web driver');

    // For web testing, try direct WebDriverIO first, then fallback to Appium
    try {
      await this._initDirectWebDriver(options);
    } catch (directError) {
      logger.warn('DRIVER', 'Direct WebDriver failed, trying Appium', { error: directError.message });
      await this._initAppiumWebDriver(options);
    }
  }

  /**
   * Initialize direct WebDriverIO (non-Appium) for web testing
   */
  async _initDirectWebDriver(options = {}) {
    const capabilities = {
      browserName: config.appium.webCapabilities.browserName,
      'goog:chromeOptions': config.appium.webCapabilities['goog:chromeOptions'],
      ...options.capabilities
    };

    const wdioOptions = {
      capabilities,
      logLevel: config.appium.logLevel,
      waitforTimeout: config.testing.waitForElementTimeout,
      connectionRetryTimeout: config.testing.defaultTimeout,
      connectionRetryCount: config.testing.retryAttempts,
      ...options.wdio
    };

    this.driver = await remote(wdioOptions);
    this.sessionId = this.driver.sessionId;

    logger.success('DRIVER', 'Direct web driver initialized', {
      sessionId: this.sessionId,
      browser: capabilities.browserName
    });

    // Set window size if specified
    if (options.windowSize) {
      await this.driver.setWindowSize(options.windowSize.width, options.windowSize.height);
    }
  }

  /**
   * Initialize Appium-based web driver
   */
  async _initAppiumWebDriver(options = {}) {
    const capabilities = {
      ...config.appium.webCapabilities,
      ...options.capabilities
    };

    const wdioOptions = {
      hostname: this._parseHostname(config.appium.serverUrl),
      port: this._parsePort(config.appium.serverUrl),
      path: '/',
      capabilities,
      logLevel: config.appium.logLevel,
      waitforTimeout: config.testing.waitForElementTimeout,
      connectionRetryTimeout: config.testing.defaultTimeout,
      connectionRetryCount: config.testing.retryAttempts,
      ...options.wdio
    };

    this.driver = await remote(wdioOptions);
    this.sessionId = this.driver.sessionId;

    logger.success('DRIVER', 'Appium web driver initialized', {
      sessionId: this.sessionId,
      browser: capabilities.browserName
    });

    // Set window size if specified
    if (options.windowSize) {
      await this.driver.setWindowSize(options.windowSize.width, options.windowSize.height);
    }
  }

  /**
   * Initialize Appium driver for mobile testing
   * @param {string} platform - 'android' or 'ios'
   * @param {object} options - Driver options
   * @returns {Promise<void>}
   */
  async initMobileDriver(platform, options = {}) {
    logger.info('DRIVER', `Initializing ${platform} driver`);

    const platformCapabilities = platform.toLowerCase() === 'android' 
      ? config.appium.androidCapabilities 
      : config.appium.iosCapabilities;

    const capabilities = {
      ...platformCapabilities,
      ...options.capabilities
    };

    const wdioOptions = {
      hostname: this._parseHostname(config.appium.serverUrl),
      port: this._parsePort(config.appium.serverUrl),
      path: '/',
      capabilities,
      logLevel: config.appium.logLevel,
      waitforTimeout: config.testing.waitForElementTimeout,
      connectionRetryTimeout: config.testing.defaultTimeout,
      connectionRetryCount: config.testing.retryAttempts,
      ...options.wdio
    };

    try {
      this.driver = await remote(wdioOptions);
      this.sessionId = this.driver.sessionId;

      logger.success('DRIVER', `${platform} driver initialized`, {
        sessionId: this.sessionId,
        platform: capabilities.platformName,
        automationName: capabilities['appium:automationName']
      });

    } catch (error) {
      logger.error('DRIVER', `Failed to initialize ${platform} driver`, { error: error.message });
      throw new Error(`Driver initialization failed: ${error.message}`);
    }
  }

  /**
   * Navigate to URL (web only)
   * @param {string} url - Target URL
   * @returns {Promise<void>}
   */
  async navigateTo(url) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    logger.info('DRIVER', `Navigating to: ${url}`);
    
    try {
      await this.driver.url(url);
      
      // Wait for page to load
      await this.driver.pause(config.testing.stepDelay);
      
      logger.success('DRIVER', `Navigation completed: ${url}`);
    } catch (error) {
      logger.error('DRIVER', 'Navigation failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Take screenshot and return base64 data
   * @param {string} filename - Optional filename for saving
   * @returns {Promise<string>} Base64 screenshot data
   */
  async takeScreenshot(filename) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    try {
      this.screenshotCounter++;
      const screenshotBase64 = await this.driver.takeScreenshot();

      // Save screenshot if enabled
      if (config.screenshots.save) {
        const screenshotFilename = filename || `screenshot_${this.screenshotCounter}_${Date.now()}.png`;
        await this._saveScreenshot(screenshotBase64, screenshotFilename);
      }

      logger.screenshot(filename || `auto_${this.screenshotCounter}`, 'captured');
      return screenshotBase64;

    } catch (error) {
      logger.error('DRIVER', 'Failed to take screenshot', { error: error.message });
      throw error;
    }
  }

  /**
   * Find element by locator
   * @param {string} locator - Element locator (CSS, XPath, etc.)
   * @param {object} options - Find options
   * @returns {Promise<object>} WebDriver element
   */
  async findElement(locator, options = {}) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    const timeout = options.timeout || config.testing.waitForElementTimeout;
    
    try {
      logger.debug('DRIVER', `Finding element: ${locator}`, { timeout });
      
      const element = await this.driver.$(locator);
      await element.waitForExist({ timeout });
      
      logger.debug('DRIVER', `Element found: ${locator}`);
      return element;

    } catch (error) {
      logger.error('DRIVER', `Element not found: ${locator}`, { 
        timeout,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Click on element
   * @param {string} locator - Element locator
   * @param {object} options - Click options
   * @returns {Promise<void>}
   */
  async clickElement(locator, options = {}) {
    logger.info('DRIVER', `Clicking element: ${locator}`);
    
    try {
      const element = await this.findElement(locator, options);
      await element.waitForClickable({ timeout: config.testing.waitForElementTimeout });
      await element.click();
      
      // Add delay after action
      await this.driver.pause(config.testing.stepDelay);
      
      logger.success('DRIVER', `Clicked element: ${locator}`);
    } catch (error) {
      logger.error('DRIVER', `Click failed: ${locator}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Type text into element
   * @param {string} locator - Element locator
   * @param {string} text - Text to type
   * @param {object} options - Type options
   * @returns {Promise<void>}
   */
  async typeText(locator, text, options = {}) {
    logger.info('DRIVER', `Typing text into: ${locator}`, { text: text.substring(0, 50) + '...' });
    
    try {
      const element = await this.findElement(locator, options);
      
      if (options.clear !== false) {
        await element.clearValue();
      }
      
      await element.setValue(text);
      
      // Add delay after action
      await this.driver.pause(config.testing.stepDelay);
      
      logger.success('DRIVER', `Text typed into: ${locator}`);
    } catch (error) {
      logger.error('DRIVER', `Type failed: ${locator}`, { 
        text: text.substring(0, 50) + '...',
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Wait for element to be present
   * @param {string} locator - Element locator
   * @param {number} timeout - Wait timeout
   * @returns {Promise<void>}
   */
  async waitForElement(locator, timeout = config.testing.waitForElementTimeout) {
    logger.info('DRIVER', `Waiting for element: ${locator}`, { timeout });
    
    try {
      const element = await this.driver.$(locator);
      await element.waitForExist({ timeout });
      
      logger.success('DRIVER', `Element appeared: ${locator}`);
    } catch (error) {
      logger.error('DRIVER', `Element wait timeout: ${locator}`, { 
        timeout,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get element text content
   * @param {string} locator - Element locator
   * @returns {Promise<string>} Element text
   */
  async getElementText(locator) {
    try {
      const element = await this.findElement(locator);
      const text = await element.getText();
      
      logger.debug('DRIVER', `Element text: ${locator}`, { text: text.substring(0, 100) });
      return text;
    } catch (error) {
      logger.error('DRIVER', `Failed to get text: ${locator}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Click at specific coordinates with validation
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {object} boundingBox - Optional bounding box for validation
   * @returns {Promise<void>}
   */
  async clickAtCoordinates(x, y, boundingBox = null) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    // Get viewport-aware screen dimensions
    const viewportInfo = await this.getViewportInfo();
    const validatedCoords = this._validateCoordinatesWithViewport(x, y, viewportInfo, boundingBox);
    
    logger.info('DRIVER', `Clicking at coordinates: (${validatedCoords.x}, ${validatedCoords.y})`, {
      original: { x, y },
      wasAdjusted: validatedCoords.wasAdjusted,
      adjustmentReason: validatedCoords.adjustmentReason,
      viewport: { 
        width: viewportInfo.viewport.width, 
        height: viewportInfo.viewport.height,
        scroll: { x: viewportInfo.viewport.scrollX, y: viewportInfo.viewport.scrollY }
      }
    });
    
    try {
      // Use enhanced pointer actions with sub-pixel precision
      await this.driver.performActions([{
        type: 'pointer',
        id: 'precisionMouse',
        parameters: { pointerType: 'mouse' },
        actions: [
          // Move to coordinate with smooth transition
          { type: 'pointerMove', duration: 50, x: validatedCoords.x, y: validatedCoords.y },
          // Brief pause to ensure pointer is positioned
          { type: 'pause', duration: 10 },
          // Precise click with minimal delay
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 25 }, // Brief hold for better registration
          { type: 'pointerUp', button: 0 }
        ]
      }]);

      // Add delay after action
      await this.driver.pause(config.testing.stepDelay);
      
      logger.success('DRIVER', `Clicked at coordinates: (${validatedCoords.x}, ${validatedCoords.y})` + 
        (validatedCoords.wasAdjusted ? ` (adjusted: ${validatedCoords.adjustmentReason})` : ''));
    } catch (error) {
      logger.error('DRIVER', `Coordinate click failed: (${validatedCoords.x}, ${validatedCoords.y})`, { 
        error: error.message,
        wasAdjusted: validatedCoords.wasAdjusted 
      });
      throw error;
    }
  }

  /**
   * Double click at specific coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Promise<void>}
   */
  async doubleClickAtCoordinates(x, y) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    logger.info('DRIVER', `Double clicking at coordinates: (${x}, ${y})`);
    
    try {
      await this.driver.performActions([{
        type: 'pointer',
        id: 'mouse',
        actions: [
          { type: 'pointerMove', duration: 0, x: x, y: y },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 }
        ]
      }]);

      await this.driver.pause(config.testing.stepDelay);
      logger.success('DRIVER', `Double clicked at coordinates: (${x}, ${y})`);
    } catch (error) {
      logger.error('DRIVER', `Coordinate double click failed: (${x}, ${y})`, { error: error.message });
      throw error;
    }
  }

  /**
   * Enhanced email input at coordinates with improved reliability
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate  
   * @param {string} email - Email address to type
   * @param {object} options - Type options
   * @returns {Promise<void>}
   */
  async typeEmailAtCoordinates(x, y, email, options = {}) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    // Get viewport-aware coordinate validation
    const viewportInfo = await this.getViewportInfo();
    const validatedCoords = this._validateCoordinatesWithViewport(x, y, viewportInfo, options.boundingBox);

    logger.info('DRIVER', `Typing email at coordinates: (${validatedCoords.x}, ${validatedCoords.y})`, { 
      email: email.substring(0, email.indexOf('@')) + '@***',
      originalCoords: { x, y },
      wasAdjusted: validatedCoords.wasAdjusted,
      adjustmentReason: validatedCoords.adjustmentReason
    });
    
    try {
      // Multiple click attempts for better focus
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Advanced input element detection with multiple strategies
          const inputElement = await this.driver.execute((x, y) => {
            // Strategy 1: Direct element detection
            const element = document.elementFromPoint(x, y);
            
            // Strategy 2: Check all elements at point (handles z-index overlays)
            let elementsAtPoint = [];
            if (document.elementsFromPoint) {
              elementsAtPoint = document.elementsFromPoint(x, y);
            } else {
              elementsAtPoint = [element];
            }
            
            // Check if any element at this point is an input
            for (let el of elementsAtPoint) {
              if (el && el.tagName && el.tagName.toLowerCase() === 'input') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) { // Must be visible
                  return { found: true, element: el, method: 'layered-direct', tagName: el.tagName };
                }
              }
            }
            
            // Strategy 3: Search within each element at point for child inputs
            for (let el of elementsAtPoint) {
              if (el && el.querySelectorAll) {
                const inputs = el.querySelectorAll('input[type="email"], input[type="text"], input[placeholder*="email" i], input[name*="email" i], input[id*="email" i]');
                for (let input of inputs) {
                  const rect = input.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) { // Must be visible
                    return { found: true, element: input, method: 'layered-child', parentTag: el.tagName };
                  }
                }
              }
            }
            
            // Strategy 4: Broader search for nearby email inputs
            const allInputs = document.querySelectorAll('input[type="email"], input[type="text"], input[placeholder*="email" i], input[name*="email" i], input[id*="email" i]');
            let bestMatch = null;
            let bestDistance = Infinity;
            
            for (let input of allInputs) {
              const rect = input.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) { // Must be visible
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
                
                // Check if point is within the input's bounding box (most reliable)
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                  return { found: true, element: input, method: 'bbox-contains', distance: 0 };
                }
                
                // Track closest input within 100 pixels
                if (distance <= 100 && distance < bestDistance) {
                  bestMatch = input;
                  bestDistance = distance;
                }
              }
            }
            
            if (bestMatch) {
              return { found: true, element: bestMatch, method: 'nearby-best', distance: bestDistance };
            }
            
            // Strategy 5: Look for input fields by common email field patterns
            const emailPatterns = [
              'input[autocomplete*="email"]',
              'input[name="email"]',
              'input[name="username"]',
              'input[id="email"]',
              'input[id*="email"]',
              'input[class*="email"]',
              'input[data-testid*="email"]'
            ];
            
            for (let pattern of emailPatterns) {
              const inputs = document.querySelectorAll(pattern);
              for (let input of inputs) {
                const rect = input.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  const distance = Math.sqrt(Math.pow((rect.left + rect.width/2) - x, 2) + Math.pow((rect.top + rect.height/2) - y, 2));
                  if (distance <= 100) {
                    return { found: true, element: input, method: 'pattern-match', pattern: pattern, distance: distance };
                  }
                }
              }
            }
            
            return { 
              found: false, 
              clickedElement: element ? element.tagName : null,
              elementsAtPoint: elementsAtPoint.map(el => el ? el.tagName : null).slice(0, 5)
            };
          }, validatedCoords.x, validatedCoords.y);
          
          if (inputElement.found) {
            logger.info('DRIVER', `Found input element using ${inputElement.method} method on attempt ${attempt}`, {
              distance: inputElement.distance || 0
            });
            
            // Focus the found input element directly using comprehensive re-finding
            const focusResult = await this.driver.execute((method, pattern, x, y) => {
              let element = null;
              
              // Re-find the element using the same method that found it originally
              if (method === 'layered-direct' || method === 'bbox-contains') {
                // For layered-direct, check all elements at point for inputs
                if (document.elementsFromPoint) {
                  const elementsAtPoint = document.elementsFromPoint(x, y);
                  for (let el of elementsAtPoint) {
                    if (el && el.tagName && el.tagName.toLowerCase() === 'input') {
                      const rect = el.getBoundingClientRect();
                      if (rect.width > 0 && rect.height > 0) {
                        element = el;
                        break;
                      }
                    }
                  }
                }
              } else if (method === 'layered-child' || method === 'nearby-best') {
                // Search all possible inputs and find the closest
                const allInputs = document.querySelectorAll('input[type="email"], input[type="text"], input[placeholder*="email" i], input[name*="email" i], input[id*="email" i]');
                let bestMatch = null;
                let bestDistance = Infinity;
                
                for (let input of allInputs) {
                  const rect = input.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    // Check if point is within bounding box first
                    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                      element = input;
                      break;
                    }
                    
                    // Otherwise find closest
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
                    if (distance < bestDistance) {
                      bestMatch = input;
                      bestDistance = distance;
                    }
                  }
                }
                
                if (!element && bestMatch && bestDistance <= 100) {
                  element = bestMatch;
                }
              } else if (method === 'pattern-match' && pattern) {
                // Use the specific pattern that worked
                const inputs = document.querySelectorAll(pattern);
                for (let input of inputs) {
                  const rect = input.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    const distance = Math.sqrt(Math.pow((rect.left + rect.width/2) - x, 2) + Math.pow((rect.top + rect.height/2) - y, 2));
                    if (distance <= 100) {
                      element = input;
                      break;
                    }
                  }
                }
              }
              
              if (element && typeof element.focus === 'function') {
                try {
                  // Multiple focus methods for better compatibility
                  element.focus();
                  element.click();
                  
                  // Trigger focus and input events for frameworks that need them
                  element.dispatchEvent(new Event('focus', { bubbles: true }));
                  element.dispatchEvent(new Event('click', { bubbles: true }));
                  
                  return { 
                    success: true, 
                    elementInfo: {
                      tagName: element.tagName,
                      type: element.type,
                      id: element.id,
                      className: element.className,
                      placeholder: element.placeholder
                    }
                  };
                } catch (focusError) {
                  return { success: false, error: focusError.message };
                }
              }
              
              return { success: false, error: 'Element not found during re-focus' };
            }, inputElement.method, inputElement.pattern, validatedCoords.x, validatedCoords.y);
            
            if (!focusResult.success) {
              logger.warn('DRIVER', `Failed to focus found element: ${focusResult.error}`);
            } else {
              logger.debug('DRIVER', 'Successfully focused input element', focusResult.elementInfo);
            }
            
            await this.driver.pause(200);
          } else {
            logger.warn('DRIVER', `No input element found at coordinates, using click fallback on attempt ${attempt}`, {
              clickedElement: inputElement.clickedElement,
              elementsAtPoint: inputElement.elementsAtPoint,
              coordinates: { x: validatedCoords.x, y: validatedCoords.y }
            });
            
            // Fallback to regular click
            await this.driver.performActions([{
              type: 'pointer',
              id: 'mouse',
              actions: [
                { type: 'pointerMove', duration: 100, x: validatedCoords.x, y: validatedCoords.y },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 50 },
                { type: 'pointerUp', button: 0 }
              ]
            }]);
          }
          
          await this.driver.pause(300);
          
          // Enhanced input field validation with element analysis
          const focusCheck = await this.driver.execute(() => {
            const active = document.activeElement;
            
            // Comprehensive input field validation
            const isInputField = active && (
              active.tagName.toLowerCase() === 'input' || 
              active.tagName.toLowerCase() === 'textarea'
            );
            
            const isEmailType = active && (
              (active.type && active.type.toLowerCase() === 'email') ||
              (active.placeholder && active.placeholder.toLowerCase().includes('email')) ||
              (active.name && active.name.toLowerCase().includes('email')) ||
              (active.id && active.id.toLowerCase().includes('email'))
            );
            
            // Check if element is properly focusable and visible
            const elementRect = active ? active.getBoundingClientRect() : null;
            const isVisible = elementRect && 
              elementRect.width > 0 && 
              elementRect.height > 0 &&
              elementRect.top >= 0 && 
              elementRect.left >= 0;
            
            // Check field attributes for validation
            const hasEmailHints = active && (
              (active.autocomplete && active.autocomplete.includes('email')) ||
              (active.inputMode && active.inputMode === 'email') ||
              (active.getAttribute('aria-label') && active.getAttribute('aria-label').toLowerCase().includes('email'))
            );
            
            return {
              tagName: active ? active.tagName.toLowerCase() : null,
              type: active ? (active.type || 'text') : null,
              id: active ? active.id : null,
              className: active ? active.className : null,
              name: active ? active.name : null,
              placeholder: active ? active.placeholder : null,
              isInputField,
              isEmailType,
              isVisible,
              hasEmailHints,
              isReadOnly: active ? active.readOnly : false,
              isDisabled: active ? active.disabled : false,
              elementRect: elementRect ? {
                x: Math.round(elementRect.left),
                y: Math.round(elementRect.top),
                width: Math.round(elementRect.width),
                height: Math.round(elementRect.height)
              } : null
            };
          });
          
          // Enhanced validation for email input field focus
          if (focusCheck.isInputField && focusCheck.isVisible && !focusCheck.isDisabled && !focusCheck.isReadOnly) {
            logger.debug('DRIVER', `Valid input field focused on attempt ${attempt}`, {
              element: {
                tag: focusCheck.tagName,
                type: focusCheck.type,
                id: focusCheck.id,
                isEmailType: focusCheck.isEmailType,
                hasEmailHints: focusCheck.hasEmailHints
              },
              bounds: focusCheck.elementRect
            });
            
            // Additional validation for email-specific fields
            if (focusCheck.isEmailType || focusCheck.hasEmailHints) {
              logger.success('DRIVER', 'Confirmed email input field focus', {
                emailIndicators: {
                  type: focusCheck.type,
                  placeholder: focusCheck.placeholder,
                  name: focusCheck.name,
                  id: focusCheck.id
                }
              });
            }
            break;
          } else if (attempt === 3) {
            logger.error('DRIVER', 'Input field validation failed after 3 attempts', {
              focusCheck,
              reasons: [
                !focusCheck.isInputField && 'Not an input field',
                !focusCheck.isVisible && 'Element not visible',
                focusCheck.isDisabled && 'Element disabled',
                focusCheck.isReadOnly && 'Element read-only'
              ].filter(Boolean)
            });
            throw new Error('Unable to focus valid input field for email entry');
          } else {
            logger.warn('DRIVER', `Invalid input field on attempt ${attempt}, retrying`, {
              element: focusCheck.tagName,
              issues: [
                !focusCheck.isInputField && 'not input',
                !focusCheck.isVisible && 'not visible', 
                focusCheck.isDisabled && 'disabled',
                focusCheck.isReadOnly && 'readonly'
              ].filter(Boolean)
            });
          }
          
        } catch (clickError) {
          if (attempt === 3) throw clickError;
          logger.warn('DRIVER', `Click attempt ${attempt} failed, retrying`, { error: clickError.message });
          await this.driver.pause(200);
        }
      }

      // Enhanced clearing for email inputs
      if (options.clear !== false) {
        await this._clearEmailField();
      }
      
      // Type email with enhanced validation
      await this._typeEmailText(email);
      
      await this.driver.pause(config.testing.stepDelay);
      logger.success('DRIVER', `Email typed at coordinates: (${validatedCoords.x}, ${validatedCoords.y})`);
      
    } catch (error) {
      const errorDetails = {
        error: error.message,
        stack: error.stack,
        originalCoords: { x, y },
        validatedCoords: { x: validatedCoords.x, y: validatedCoords.y },
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
      };
      
      logger.error('DRIVER', `Email type at coordinates failed: (${validatedCoords.x}, ${validatedCoords.y})`, errorDetails);
      
      // Create a more descriptive error for upstream handling
      const enhancedError = new Error(`Email input failed at (${validatedCoords.x}, ${validatedCoords.y}): ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.coordinates = { x: validatedCoords.x, y: validatedCoords.y };
      enhancedError.details = errorDetails;
      
      throw enhancedError;
    }
  }

  /**
   * Clear email field using multiple methods
   * @private
   */
  async _clearEmailField() {
    const clearMethods = [
      // Method 1: Triple-click to select all, then delete
      async () => {
        await this.driver.performActions([{
          type: 'pointer',
          id: 'mouse',
          actions: [
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
            { type: 'pause', duration: 50 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
            { type: 'pause', duration: 50 },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
        await this.driver.pause(100);
        await this.driver.keys(['Delete']);
      },
      
      // Method 2: Ctrl+A and Delete
      async () => {
        await this.driver.keys(['Control', 'a']);
        await this.driver.pause(100);
        await this.driver.keys(['Delete']);
      },
      
      // Method 3: Home, Shift+End, Delete
      async () => {
        await this.driver.keys(['Home']);
        await this.driver.pause(50);
        await this.driver.keys(['Shift', 'End']);
        await this.driver.pause(50);
        await this.driver.keys(['Delete']);
      },
      
      // Method 4: Backspace multiple times
      async () => {
        for (let i = 0; i < 100; i++) {
          await this.driver.keys(['Backspace']);
          if (i % 20 === 19) await this.driver.pause(50);
        }
      }
    ];

    for (let i = 0; i < clearMethods.length; i++) {
      try {
        await clearMethods[i]();
        await this.driver.pause(200);
        
        // Check if field is cleared by getting its value
        const fieldValue = await this.driver.execute(() => {
          const active = document.activeElement;
          return active ? active.value || '' : '';
        });
        
        if (!fieldValue || fieldValue.trim() === '') {
          logger.debug('DRIVER', `Field cleared using method ${i + 1}`);
          return;
        }
        
      } catch (error) {
        logger.warn('DRIVER', `Clear method ${i + 1} failed`, { error: error.message });
      }
    }
    
    logger.warn('DRIVER', 'All clear methods completed, field may still contain text');
  }

  /**
   * Type email text with validation and error recovery
   * @private
   */
  async _typeEmailText(email) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn('DRIVER', 'Invalid email format provided', { email });
    }

    // Type email character by character with special handling
    const chars = Array.from(email);
    let typedSoFar = '';
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      try {
        await this.driver.keys([char]);
        typedSoFar += char;
        
        // Extra delay after @ symbol and dots for email parsing
        if (char === '@' || char === '.') {
          await this.driver.pause(100);
        }
        
        // Verification every 10 characters
        if (i % 10 === 9) {
          await this.driver.pause(50);
          
          // Verify typing progress
          const currentValue = await this.driver.execute(() => {
            const active = document.activeElement;
            return active ? active.value || '' : '';
          });
          
          if (!currentValue.includes(typedSoFar.substring(0, Math.min(5, typedSoFar.length)))) {
            logger.warn('DRIVER', `Typing verification failed, field may not be receiving input correctly`, {
              expected: typedSoFar.substring(0, 20),
              actual: currentValue.substring(0, 20)
            });
          }
        }
        
      } catch (charError) {
        logger.warn('DRIVER', `Failed to type character: '${char}'`, { error: charError.message });
        // Continue with remaining characters
      }
    }
    
    // Final verification
    await this.driver.pause(200);
    const finalValue = await this.driver.execute(() => {
      const active = document.activeElement;
      return active ? active.value || '' : '';
    });
    
    if (finalValue !== email) {
      logger.warn('DRIVER', 'Email typing verification failed', {
        expected: email,
        actual: finalValue,
        match: finalValue === email
      });
    } else {
      logger.debug('DRIVER', 'Email typing verified successfully');
    }
  }

  /**
   * Type text at specific coordinates (click first, then type)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate  
   * @param {string} text - Text to type
   * @param {object} options - Type options
   * @returns {Promise<void>}
   */
  async typeAtCoordinates(x, y, text, options = {}) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    // Get viewport-aware coordinate validation
    const viewportInfo = await this.getViewportInfo();
    const validatedCoords = this._validateCoordinatesWithViewport(x, y, viewportInfo, options.boundingBox);

    logger.info('DRIVER', `Typing at coordinates: (${validatedCoords.x}, ${validatedCoords.y})`, { 
      text: text.substring(0, 50) + '...',
      originalCoords: { x, y },
      wasAdjusted: validatedCoords.wasAdjusted,
      adjustmentReason: validatedCoords.adjustmentReason,
      viewport: { 
        width: viewportInfo.viewport.width, 
        height: viewportInfo.viewport.height,
        scroll: { x: viewportInfo.viewport.scrollX, y: viewportInfo.viewport.scrollY }
      }
    });
    
    try {
      // First try to find the input element at these coordinates
      const inputElement = await this.driver.execute((x, y) => {
        const element = document.elementFromPoint(x, y);
        if (element) {
          // Check if the element is an input field or if it contains one
          if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
            return { found: true, element: element, method: 'direct' };
          }
          
          // Look for input elements within the clicked element
          const inputs = element.querySelectorAll('input, textarea');
          if (inputs.length > 0) {
            return { found: true, element: inputs[0], method: 'child' };
          }
          
          // Look for nearby input elements within a reasonable distance
          const allInputs = document.querySelectorAll('input, textarea');
          for (let input of allInputs) {
            const rect = input.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
            if (distance <= 50) { // Within 50 pixels
              return { found: true, element: input, method: 'nearby', distance: distance };
            }
          }
        }
        return { found: false, clickedElement: element ? element.tagName : null };
      }, validatedCoords.x, validatedCoords.y);

      if (inputElement.found) {
        logger.info('DRIVER', `Found input element using ${inputElement.method} method`, {
          distance: inputElement.distance || 0
        });
        
        // Focus the found input element directly
        await this.driver.execute((elementId, method) => {
          let element;
          if (method === 'direct') {
            element = document.elementFromPoint(arguments[2], arguments[3]);
          } else if (method === 'child' || method === 'nearby') {
            // For child or nearby elements, we need to re-find them
            const allInputs = document.querySelectorAll('input, textarea');
            for (let input of allInputs) {
              const rect = input.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const distance = Math.sqrt(Math.pow(centerX - arguments[2], 2) + Math.pow(centerY - arguments[3], 2));
              if (distance <= 50) {
                element = input;
                break;
              }
            }
          }
          
          if (element && typeof element.focus === 'function') {
            element.focus();
            element.click(); // Also trigger a click for good measure
            return true;
          }
          return false;
        }, inputElement.element, inputElement.method, validatedCoords.x, validatedCoords.y);
        
        await this.driver.pause(300);
      } else {
        logger.warn('DRIVER', 'No input element found at coordinates, using click fallback', {
          clickedElement: inputElement.clickedElement
        });
        
        // Enhanced precision click to focus the input field
        await this.driver.performActions([{
          type: 'pointer',
          id: 'inputFocusMouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            // Smooth move to precise coordinates
            { type: 'pointerMove', duration: 75, x: validatedCoords.x, y: validatedCoords.y },
            // Stabilization pause
            { type: 'pause', duration: 15 },
            // Focus click with longer hold for input field activation
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 40 }, // Longer hold for input field focus
            { type: 'pointerUp', button: 0 },
            // Additional pause for field activation
            { type: 'pause', duration: 25 }
          ]
        }]);

        // Wait for focus and validate input field
        await this.driver.pause(500);
      }
      
      // Enhanced input field validation
      const fieldValidation = await this.driver.execute(() => {
        const active = document.activeElement;
        
        const isInputField = active && (
          active.tagName.toLowerCase() === 'input' || 
          active.tagName.toLowerCase() === 'textarea'
        );
        
        const elementRect = active ? active.getBoundingClientRect() : null;
        const isVisible = elementRect && 
          elementRect.width > 0 && 
          elementRect.height > 0 &&
          elementRect.top >= 0 && 
          elementRect.left >= 0;
        
        return {
          tagName: active ? active.tagName.toLowerCase() : null,
          type: active ? (active.type || 'text') : null,
          id: active ? active.id : null,
          className: active ? active.className : null,
          placeholder: active ? active.placeholder : null,
          isInputField,
          isVisible,
          isReadOnly: active ? active.readOnly : false,
          isDisabled: active ? active.disabled : false,
          elementRect: elementRect ? {
            x: Math.round(elementRect.left),
            y: Math.round(elementRect.top),
            width: Math.round(elementRect.width),
            height: Math.round(elementRect.height)
          } : null
        };
      });
      
      if (!fieldValidation.isInputField || !fieldValidation.isVisible || 
          fieldValidation.isDisabled || fieldValidation.isReadOnly) {
        logger.error('DRIVER', 'Invalid input field for typing', {
          validation: fieldValidation,
          coordinates: { x: validatedCoords.x, y: validatedCoords.y },
          issues: [
            !fieldValidation.isInputField && 'Not an input field',
            !fieldValidation.isVisible && 'Element not visible',
            fieldValidation.isDisabled && 'Element disabled',
            fieldValidation.isReadOnly && 'Element read-only'
          ].filter(Boolean)
        });
        throw new Error(`Invalid input field for typing: ${[
          !fieldValidation.isInputField && 'not input field',
          !fieldValidation.isVisible && 'not visible',
          fieldValidation.isDisabled && 'disabled',
          fieldValidation.isReadOnly && 'readonly'
        ].filter(Boolean).join(', ')}`);
      }
      
      logger.debug('DRIVER', 'Input field validation successful', {
        element: {
          tag: fieldValidation.tagName,
          type: fieldValidation.type,
          id: fieldValidation.id,
          placeholder: fieldValidation.placeholder
        },
        bounds: fieldValidation.elementRect
      });
      
      // Clear existing text if requested (default: true)
      if (options.clear !== false) {
        // Try multiple clearing methods for better compatibility
        try {
          // Method 1: Select all and delete
          await this.driver.keys(['Control', 'a']);
          await this.driver.pause(100);
          await this.driver.keys(['Delete']);
          await this.driver.pause(200);
        } catch (clearError) {
          logger.warn('DRIVER', 'Clear method 1 failed, trying method 2', { error: clearError.message });
          // Method 2: Use backspace repeatedly
          for (let i = 0; i < 50; i++) {
            await this.driver.keys(['Backspace']);
          }
        }
      }
      
      // Type the text character by character for better reliability
      const textArray = Array.from(text);
      for (let i = 0; i < textArray.length; i++) {
        await this.driver.keys([textArray[i]]);
        // Small delay between characters for complex inputs
        if (i % 10 === 9) { // Every 10 characters
          await this.driver.pause(50);
        }
      }
      
      await this.driver.pause(config.testing.stepDelay);
      logger.success('DRIVER', `Typed text at coordinates: (${validatedCoords.x}, ${validatedCoords.y})`, {
        textLength: text.length,
        preview: text.substring(0, 20) + (text.length > 20 ? '...' : '')
      });
      
    } catch (error) {
      logger.error('DRIVER', `Type at coordinates failed: (${validatedCoords.x}, ${validatedCoords.y})`, { 
        text: text.substring(0, 50) + '...',
        error: error.message,
        originalCoords: { x, y }
      });
      throw error;
    }
  }

  /**
   * Scroll in specified direction
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @param {number} amount - Scroll amount (pixels)
   * @returns {Promise<void>}
   */
  async scroll(direction, amount = 500) {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    logger.info('DRIVER', `Scrolling ${direction} by ${amount}px`);
    
    try {
      // Get window size for scroll calculations
      const windowSize = await this.driver.getWindowSize();
      const centerX = windowSize.width / 2;
      const centerY = windowSize.height / 2;

      let startX = centerX, startY = centerY;
      let endX = centerX, endY = centerY;

      switch (direction.toLowerCase()) {
        case 'up':
          endY = centerY - amount;
          break;
        case 'down':
          endY = centerY + amount;
          break;
        case 'left':
          endX = centerX - amount;
          break;
        case 'right':
          endX = centerX + amount;
          break;
        default:
          throw new Error(`Invalid scroll direction: ${direction}`);
      }

      await this.driver.performActions([{
        type: 'pointer',
        id: 'mouse',
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 500, x: endX, y: endY },
          { type: 'pointerUp', button: 0 }
        ]
      }]);

      await this.driver.pause(config.testing.stepDelay);
      logger.success('DRIVER', `Scrolled ${direction} by ${amount}px`);
    } catch (error) {
      logger.error('DRIVER', `Scroll failed: ${direction}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get current screen dimensions
   * @returns {Promise<object>} Screen size {width, height}
   */
  async getScreenSize() {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    try {
      const windowSize = await this.driver.getWindowSize();
      logger.debug('DRIVER', `Screen size: ${windowSize.width}x${windowSize.height}`);
      return windowSize;
    } catch (error) {
      logger.error('DRIVER', 'Failed to get screen size', { error: error.message });
      throw error;
    }
  }

  /**
   * Get viewport-aware dimensions including scroll position and browser chrome
   * @returns {Promise<Object>} Viewport details with scroll and chrome information
   */
  async getViewportInfo() {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    try {
      const windowSize = await this.driver.getWindowSize();
      
      // Get viewport dimensions and scroll position using JavaScript
      const viewportInfo = await this.driver.execute(() => {
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX || window.pageXOffset || 0,
          scrollY: window.scrollY || window.pageYOffset || 0,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight
        };
        
        return viewport;
      });

      // Calculate browser chrome dimensions
      const browserChrome = {
        width: windowSize.width - viewportInfo.width,
        height: windowSize.height - viewportInfo.height
      };

      const result = {
        window: windowSize,
        viewport: viewportInfo,
        browserChrome,
        // Enhanced safe interaction zones matching AI precision requirements
        safeZone: {
          minX: 15,  // Increased margin for better precision
          minY: Math.max(60, browserChrome.height + 15), // Account for browser toolbar with extra margin
          maxX: viewportInfo.width - 15,
          maxY: viewportInfo.height - 15
        }
      };

      logger.debug('DRIVER', 'Viewport info:', result);
      return result;
      
    } catch (error) {
      logger.error('DRIVER', 'Failed to get viewport info', { error: error.message });
      // Fallback to basic window size
      const windowSize = await this.getScreenSize();
      return {
        window: windowSize,
        viewport: windowSize,
        browserChrome: { width: 0, height: 50 },
        safeZone: {
          minX: 10,
          minY: 50,
          maxX: windowSize.width - 10,
          maxY: windowSize.height - 10
        }
      };
    }
  }

  /**
   * Validate coordinates using viewport-aware calculations
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate  
   * @param {Object} viewportInfo - Viewport information from getViewportInfo()
   * @param {Object} boundingBox - Optional bounding box constraints
   * @returns {Object} Validated coordinates with adjustment info
   */
  _validateCoordinatesWithViewport(x, y, viewportInfo, boundingBox = null) {
    // Use precise integer coordinates (no rounding loss)
    let validX = Math.floor(x + 0.5); // More precise than Math.round
    let validY = Math.floor(y + 0.5);
    let wasAdjusted = false;
    let adjustmentReason = '';

    const { safeZone, viewport } = viewportInfo;
    
    logger.debug('DRIVER', 'Viewport-aware coordinate validation', {
      original: { x, y },
      safeZone,
      viewport: { width: viewport.width, height: viewport.height },
      scrollPosition: { x: viewport.scrollX, y: viewport.scrollY },
      boundingBox
    });

    // Adjust coordinates to viewport-relative if they seem to be screen-relative
    if (x > viewport.width || y > viewport.height) {
      // Coordinates might be screen-relative, adjust to viewport-relative
      validX = Math.max(safeZone.minX, Math.min(x - viewport.scrollX, safeZone.maxX));
      validY = Math.max(safeZone.minY, Math.min(y - viewport.scrollY, safeZone.maxY));
      wasAdjusted = true;
      adjustmentReason = 'Adjusted from screen-relative to viewport-relative coordinates';
    }

    // Apply safe zone constraints
    if (validX < safeZone.minX || validX > safeZone.maxX || 
        validY < safeZone.minY || validY > safeZone.maxY) {
      
      const originalValidX = validX;
      const originalValidY = validY;
      
      validX = Math.max(safeZone.minX, Math.min(validX, safeZone.maxX));
      validY = Math.max(safeZone.minY, Math.min(validY, safeZone.maxY));
      
      wasAdjusted = true;
      adjustmentReason += (adjustmentReason ? '; ' : '') + 
        `Clamped to safe zone from (${originalValidX}, ${originalValidY})`;
      
      logger.warn('DRIVER', 'Coordinates outside safe zone, adjusted', {
        original: { x, y },
        adjusted: { x: validX, y: validY },
        safeZone
      });
    }

    // Enhanced bounding box validation with precision targeting
    if (boundingBox && boundingBox.left !== undefined) {
      const bbox = {
        left: Math.floor(boundingBox.left + 0.5),
        top: Math.floor(boundingBox.top + 0.5),
        right: Math.floor(boundingBox.right + 0.5),
        bottom: Math.floor(boundingBox.bottom + 0.5),
        width: Math.floor(boundingBox.width || (boundingBox.right - boundingBox.left)),
        height: Math.floor(boundingBox.height || (boundingBox.bottom - boundingBox.top))
      };

      logger.debug('DRIVER', 'Enhanced bounding box validation', {
        original: boundingBox,
        processed: bbox,
        coordinates: { x: validX, y: validY },
        viewport: { width: viewport.width, height: viewport.height }
      });

      // Enhanced bounding box validity checks
      const isBboxValid = 
        bbox.left >= 0 && bbox.top >= 0 && 
        bbox.right <= viewport.width && bbox.bottom <= viewport.height &&
        bbox.left < bbox.right && bbox.top < bbox.bottom &&
        bbox.width >= 10 && bbox.height >= 10; // Minimum clickable size

      if (isBboxValid) {
        // Apply safety margins within bounding box (2px from edges)
        const bboxSafeZone = {
          left: bbox.left + 2,
          right: bbox.right - 2,
          top: bbox.top + 2,
          bottom: bbox.bottom - 2
        };

        // Check if coordinates are within the bounding box safe zone
        if (validX < bboxSafeZone.left || validX > bboxSafeZone.right || 
            validY < bboxSafeZone.top || validY > bboxSafeZone.bottom) {
          
          const originalValidX = validX;
          const originalValidY = validY;
          
          // Smart positioning based on element type (inferred from bounding box)
          let targetX, targetY;
          
          if (bbox.width > 200 && bbox.height < 60) {
            // Likely an input field - target 25% from left, vertical center
            targetX = Math.floor(bbox.left + (bbox.width * 0.25));
            targetY = Math.floor(bbox.top + (bbox.height * 0.5));
          } else if (bbox.width < 200 && bbox.height < 60) {
            // Likely a button - target center
            targetX = Math.floor(bbox.left + (bbox.width * 0.5));
            targetY = Math.floor(bbox.top + (bbox.height * 0.5));
          } else {
            // General element - target center with slight offset
            targetX = Math.floor(bbox.left + (bbox.width * 0.4));
            targetY = Math.floor(bbox.top + (bbox.height * 0.4));
          }
          
          // Ensure target is within safe zone
          validX = Math.max(bboxSafeZone.left, Math.min(targetX, bboxSafeZone.right));
          validY = Math.max(bboxSafeZone.top, Math.min(targetY, bboxSafeZone.bottom));
          
          wasAdjusted = true;
          adjustmentReason += (adjustmentReason ? '; ' : '') + 
            `Smart positioned within bounding box from (${originalValidX}, ${originalValidY})`;
          
          logger.info('DRIVER', 'Coordinates optimized for bounding box', {
            bbox,
            originalCoords: { x: originalValidX, y: originalValidY },
            optimizedCoords: { x: validX, y: validY },
            strategy: bbox.width > 200 ? 'input-field' : (bbox.width < 200 ? 'button' : 'general'),
            safeZone: bboxSafeZone
          });
        } else {
          logger.debug('DRIVER', 'Coordinates within bounding box safe zone', {
            coords: { x: validX, y: validY },
            bbox,
            safeZone: bboxSafeZone
          });
        }
      } else {
        logger.warn('DRIVER', 'Invalid bounding box provided, ignoring', {
          bbox,
          issues: [
            bbox.left < 0 && 'left < 0',
            bbox.top < 0 && 'top < 0',
            bbox.right > viewport.width && 'right > viewport.width',
            bbox.bottom > viewport.height && 'bottom > viewport.height',
            bbox.left >= bbox.right && 'left >= right',
            bbox.top >= bbox.bottom && 'top >= bottom',
            bbox.width < 10 && 'width < 10px',
            bbox.height < 10 && 'height < 10px'
          ].filter(Boolean)
        });
      }
    }

    return {
      x: validX,
      y: validY,
      wasAdjusted,
      adjustmentReason,
      safeZone
    };
  }

  /**
   * Validate and adjust coordinates to be within safe bounds (legacy method)
   * @private
   */
  _validateCoordinates(x, y, screenSize, boundingBox = null) {
    let validX = Math.round(x);
    let validY = Math.round(y);

    // More conservative screen bounds validation to prevent out-of-bounds errors
    const minX = 10; // Larger buffer from edge
    const minY = 50; // Account for browser toolbar
    const maxX = screenSize.width - 10;
    const maxY = screenSize.height - 50; // Account for browser status bar

    logger.debug('DRIVER', 'Validating coordinates', {
      input: { x, y },
      screenSize,
      bounds: { minX, minY, maxX, maxY },
      boundingBox
    });

    // First check if coordinates are completely out of bounds
    if (x < 0 || y < 0 || x > screenSize.width || y > screenSize.height) {
      logger.warn('DRIVER', 'Coordinates completely out of bounds, using screen center', {
        input: { x, y },
        screenSize
      });
      validX = Math.round(screenSize.width / 2);
      validY = Math.round(screenSize.height / 2);
    } else {
      // Clamp to safe screen bounds
      validX = Math.max(minX, Math.min(maxX, validX));
      validY = Math.max(minY, Math.min(maxY, validY));
    }

    // If bounding box provided, validate against it and prefer bbox center
    if (boundingBox && boundingBox.left !== undefined) {
      const bbox = boundingBox;
      
      // Validate bounding box itself
      if (bbox.left >= 0 && bbox.top >= 0 && 
          bbox.right <= screenSize.width && bbox.bottom <= screenSize.height &&
          bbox.right > bbox.left && bbox.bottom > bbox.top) {
        
        // Use center of bounding box for safety
        validX = Math.round((bbox.left + bbox.right) / 2);
        validY = Math.round((bbox.top + bbox.bottom) / 2);
        
        // Ensure bbox center is within screen bounds
        validX = Math.max(minX, Math.min(maxX, validX));
        validY = Math.max(minY, Math.min(maxY, validY));
        
        logger.info('DRIVER', 'Using bounding box center coordinates', {
          original: { x, y },
          bboxCenter: { x: validX, y: validY },
          boundingBox: bbox
        });
      } else {
        logger.warn('DRIVER', 'Invalid bounding box, using validated coordinates', {
          boundingBox: bbox,
          screenSize
        });
      }
    }

    // Final bounds check
    if (validX < minX || validX > maxX || validY < minY || validY > maxY) {
      logger.warn('DRIVER', 'Final bounds check failed, using safe center coordinates', {
        calculated: { x: validX, y: validY },
        bounds: { minX, minY, maxX, maxY }
      });
      validX = Math.round(screenSize.width / 2);
      validY = Math.round(screenSize.height / 2);
    }

    return { x: validX, y: validY };
  }

  /**
   * Close driver session
   * @returns {Promise<void>}
   */
  async quit() {
    if (this.driver) {
      logger.info('DRIVER', 'Closing driver session', { sessionId: this.sessionId });
      
      try {
        await this.driver.deleteSession();
        logger.success('DRIVER', 'Driver session closed');
      } catch (error) {
        logger.warn('DRIVER', 'Error during driver cleanup', { error: error.message });
      }
      
      this.driver = null;
      this.sessionId = null;
    }
  }

  /**
   * Parse hostname from Appium server URL
   */
  _parseHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'localhost';
    }
  }

  /**
   * Parse port from Appium server URL
   */
  _parsePort(url) {
    try {
      return parseInt(new URL(url).port) || 4723;
    } catch {
      return 4723;
    }
  }

  /**
   * Execute action with detailed logging for iterative workflow
   * @param {object} action - Action from AI guidance
   * @returns {Promise<object>} Action result with timing and status
   */
  async executeActionWithLogging(action) {
    const startTime = Date.now();
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('DRIVER', `🎯 Executing action: ${action.action_type}`, {
      actionId,
      coordinates: action.coordinates,
      inputValue: action.input_value?.substring(0, 50) + (action.input_value?.length > 50 ? '...' : ''),
      confidence: action.confidence
    });

    let success = false;
    let errorMessage = null;
    let elementFound = false;
    let screenshotAfter = null;

    try {
      switch (action.action_type) {
        case 'click':
          await this.clickAtCoordinates(action.coordinates.x, action.coordinates.y);
          elementFound = true;
          success = true;
          break;

        case 'type':
          if (action.input_value) {
            await this.typeAtCoordinates(
              action.coordinates.x, 
              action.coordinates.y, 
              action.input_value
            );
            elementFound = true;
            success = true;
          } else {
            throw new Error('No input value provided for type action');
          }
          break;

        case 'scroll':
          await this.scrollPage(action.scroll_direction || 'down', 3);
          elementFound = true;
          success = true;
          break;

        case 'wait':
          const waitTime = action.wait_condition ? parseInt(action.wait_condition) : 2000;
          await this.driver.pause(waitTime);
          elementFound = true;
          success = true;
          break;

        case 'navigate':
          if (action.input_value) {
            await this.driver.navigateTo(action.input_value);
            elementFound = true;
            success = true;
          } else {
            throw new Error('No URL provided for navigate action');
          }
          break;

        default:
          throw new Error(`Unsupported action type: ${action.action_type}`);
      }

      // Take screenshot after successful action
      screenshotAfter = await this.takeScreenshot();

    } catch (error) {
      success = false;
      errorMessage = error.message;
      elementFound = false;
      
      // Still take screenshot to show current state
      try {
        screenshotAfter = await this.takeScreenshot();
      } catch (screenshotError) {
        logger.warn('DRIVER', 'Failed to take screenshot after error', { 
          error: screenshotError.message 
        });
      }
    }

    const executionTime = (Date.now() - startTime) / 1000;

    const actionResult = {
      action_type: action.action_type,
      success: success,
      coordinates: action.coordinates,
      input_value: action.input_value,
      error_message: errorMessage,
      execution_time: executionTime,
      element_found: elementFound,
      screenshot_after: screenshotAfter
    };

    const appiumLog = {
      command: action.action_type,
      status: success ? 'success' : 'failed',
      response_time: executionTime * 1000,
      session_id: this.sessionId,
      error_details: errorMessage,
      element_info: {
        type: action.element_info?.element_type,
        description: action.element_info?.description,
        coordinates: action.coordinates
      }
    };

    // Store logs for session
    this.actionLogs.push(appiumLog);

    logger.info('DRIVER', `${success ? '✅' : '❌'} Action completed: ${action.action_type}`, {
      actionId,
      success,
      executionTime: `${executionTime.toFixed(2)}s`,
      errorMessage: errorMessage?.substring(0, 100)
    });

    return {
      actionResult,
      appiumLog,
      screenshotAfter
    };
  }

  /**
   * Get recent action logs for iterative feedback
   * @param {number} limit - Number of recent logs to return
   * @returns {Array} Recent action logs
   */
  getRecentLogs(limit = 5) {
    return this.actionLogs.slice(-limit);
  }

  /**
   * Clear action logs
   */
  clearLogs() {
    this.actionLogs = [];
  }

  /**
   * Set session context for iterative workflow
   * @param {object} context - Session context data
   */
  setSessionContext(context) {
    this.sessionContext = { ...this.sessionContext, ...context };
  }

  /**
   * Get current session context
   * @returns {object} Current session context
   */
  getSessionContext() {
    return { ...this.sessionContext };
  }

  /**
   * Save screenshot to disk
   */
  async _saveScreenshot(base64Data, filename) {
    try {
      await fs.mkdir(config.screenshots.dir, { recursive: true });
      const filepath = path.join(config.screenshots.dir, filename);
      await fs.writeFile(filepath, base64Data, 'base64');
      
      logger.screenshot(filename, `saved to ${filepath}`);
    } catch (error) {
      logger.warn('DRIVER', 'Failed to save screenshot', { 
        filename, 
        error: error.message 
      });
    }
  }
}

export default AppiumDriverManager;