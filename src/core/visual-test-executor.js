/**
 * Visual Test Executor for Budsy
 * AI-guided test execution using screenshot analysis and coordinate-based actions
 */

import AppiumDriverManager from './appium-driver.js';
import aiClient from './ai-client.js';
import logger from './logger.js';
import config from '../config/index.js';

class VisualTestExecutor {
  constructor() {
    this.driver = new AppiumDriverManager();
    this.aiClient = aiClient;
    this.testResults = [];
    this.currentTest = null;
    this.webLogger = null; // Will be set by web server if running via web interface
  }

  // Get the appropriate logger (webLogger if available, otherwise default logger)
  get logger() {
    return this.webLogger || logger;
  }

  /**
   * Initialize visual test executor
   * @param {object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    this.logger.info('VISUAL-EXECUTOR', 'Initializing AI-guided visual test executor');

    // Pass the WebSocket logger to AI client if available
    if (this.webLogger) {
      this.aiClient.webLogger = this.webLogger;
    }

    try {
      // Check AI backend health
      const aiHealthy = await this.aiClient.healthCheck();
      if (!aiHealthy) {
        throw new Error('AI backend is not healthy');
      }

      // Initialize appropriate driver
      if (options.platform === 'web' || !options.platform) {
        await this.driver.initWebDriver(options.driver);
      } else if (options.platform === 'android' || options.platform === 'ios') {
        await this.driver.initMobileDriver(options.platform, options.driver);
      } else {
        throw new Error(`Unsupported platform: ${options.platform}`);
      }

      this.logger.success('VISUAL-EXECUTOR', 'AI-guided visual test executor initialized successfully');

    } catch (error) {
      this.logger.error('VISUAL-EXECUTOR', 'Failed to initialize visual test executor', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute test using AI visual guidance
   * @param {string} instruction - Human-readable test instruction
   * @param {string} url - Target URL (for web tests)
   * @param {object} options - Execution options
   * @returns {Promise<object>} Test execution result
   */
  async executeVisualTest(instruction, url = null, options = {}) {
    const testId = `visual_test_${Date.now()}`;
    const startTime = Date.now();

    this.currentTest = {
      id: testId,
      instruction,
      startTime,
      steps: [],
      screenshots: [],
      result: null
    };

    this.logger.testStart(instruction, { testId });

    try {
      // Navigate to URL if provided (web only)
      if (url) {
        await this.driver.navigateTo(url);
        // Wait for page to load
        await this.driver.driver.pause(2000);
      }

      // Get screen size for AI analysis
      const screenSize = await this.driver.getScreenSize();
      
      // Take initial screenshot
      let currentScreenshot = await this.driver.takeScreenshot('initial_state.png');
      this.currentTest.screenshots.push(currentScreenshot);

      this.logger.info('VISUAL-EXECUTOR', 'Starting AI-guided test execution', {
        instruction: instruction.substring(0, 100) + '...',
        screenSize
      });

      // Break down instruction into individual actions using AI
      const actionSteps = await this._parseInstructionIntoActions(instruction);
      
      this.logger.info('VISUAL-EXECUTOR', `Generated ${actionSteps.length} visual action steps`);

      // Execute each action step using AI guidance
      for (let i = 0; i < actionSteps.length; i++) {
        const actionStep = actionSteps[i];
        const stepNumber = i + 1;
        
        await this._executeVisualActionStep(stepNumber, actionStep, currentScreenshot, screenSize, options);
        
        // Take screenshot after action
        currentScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_after.png`);
        this.currentTest.screenshots.push(currentScreenshot);
      }

      // Final verification using AI
      const finalVerification = await this._performFinalVisualVerification(
        instruction, 
        currentScreenshot, 
        options
      );

      const duration = Date.now() - startTime;
      this.currentTest.result = { 
        success: finalVerification.success, 
        duration,
        verification: finalVerification
      };
      this.testResults.push(this.currentTest);

      this.logger.testEnd(instruction, finalVerification.success, duration, {
        stepsExecuted: actionSteps.length,
        screenshotsTaken: this.currentTest.screenshots.length,
        aiVerification: finalVerification
      });

      return {
        success: finalVerification.success,
        testId,
        instruction,
        stepsExecuted: actionSteps.length,
        duration,
        screenshots: this.currentTest.screenshots,
        steps: this.currentTest.steps,
        verification: finalVerification
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.currentTest.result = { success: false, error: error.message, duration };
      this.testResults.push(this.currentTest);

      this.logger.testEnd(instruction, false, duration, { error: error.message });
      throw error;
    }
  }

  /**
   * Parse instruction into individual action steps using AI
   * @private
   */
  async _parseInstructionIntoActions(instruction) {
    this.logger.info('VISUAL-EXECUTOR', 'Parsing instruction into action steps');

    try {
      const stepsResponse = await this.aiClient.generateTestSteps(instruction, {
        testType: 'visual_guided',
        useCoordinates: true
      });

      return stepsResponse.steps.map(step => ({
        description: step.description,
        action: step.action,
        value: step.value,
        expected: step.expected
      }));

    } catch (error) {
      this.logger.warn('VISUAL-EXECUTOR', 'Failed to parse with AI, using smart parsing', { error: error.message });
      
      // Enhanced fallback: smart instruction parsing
      return this._smartParseInstruction(instruction);
    }
  }

  /**
   * Smart instruction parsing with better action detection and compound instruction handling
   * @private
   */
  _smartParseInstruction(instruction) {
    const lowerInst = instruction.toLowerCase();
    const actions = [];

    this.logger.debug('VISUAL-EXECUTOR', 'Smart parsing instruction', { instruction });

    // Enhanced splitting patterns for compound instructions
    const splitPatterns = [
      /\s+(?:and then|then|and|,)\s+/i,  // Original pattern
      /\s+(?:after that|next|following that)\s+/i,
      /\s+(?:then|and)\s+(?:should|must|need to)\s+/i,
      /\.\s*(?:then|next|after|and)/i,  // Period followed by continuation
    ];

    let parts = [instruction];
    
    // Apply splitting patterns sequentially
    for (const pattern of splitPatterns) {
      const newParts = [];
      for (const part of parts) {
        newParts.push(...part.split(pattern));
      }
      parts = newParts;
    }

    // Filter and clean parts
    parts = parts.map(p => p.trim()).filter(p => p.length > 0);
    
    this.logger.debug('VISUAL-EXECUTOR', 'Split instruction into parts', { parts });

    for (const part of parts) {
      const cleanPart = part.trim().replace(/^(and|then|next|after that)\s+/i, '').trim();
      if (!cleanPart) continue;

      // Skip verification/expectation statements - they don't require actions
      if (this._isExpectationStatement(cleanPart)) {
        this.logger.debug('VISUAL-EXECUTOR', 'Skipping expectation statement', { statement: cleanPart });
        continue;
      }

      // Enhanced action detection with better patterns
      const actionInfo = this._detectActionWithValue(cleanPart);
      
      // Enhanced action descriptions for better AI recognition
      let enhancedDescription = actionInfo.enhancedDescription || cleanPart;
      
      const actionStep = {
        description: enhancedDescription,
        action: actionInfo.actionType,
        value: actionInfo.value,
        expected: null
      };

      actions.push(actionStep);
      
      this.logger.debug('VISUAL-EXECUTOR', 'Added action step', actionStep);
    }

    if (actions.length === 0) {
      // Fallback for simple instructions
      const actionInfo = this._detectActionWithValue(instruction);
      actions.push({
        description: instruction,
        action: actionInfo.actionType,
        value: actionInfo.value,
        expected: null
      });
    }

    this.logger.info('VISUAL-EXECUTOR', `Parsed instruction into ${actions.length} action steps`, {
      instruction: instruction.substring(0, 100) + (instruction.length > 100 ? '...' : ''),
      actions: actions.map(a => ({ action: a.action, description: a.description.substring(0, 50) + (a.description.length > 50 ? '...' : '') }))
    });

    return actions;
  }

  /**
   * Check if a statement is an expectation rather than an action
   * @private
   */
  _isExpectationStatement(statement) {
    const lowerStatement = statement.toLowerCase();
    
    const expectationKeywords = [
      'should appear', 'should show', 'should display', 'should be', 'should have',
      'will appear', 'will show', 'will display', 'will be',
      'appears', 'shows', 'displays', 'is visible', 'is shown',
      'expect', 'verify', 'confirm', 'check that', 'ensure that',
      'screen should', 'page should', 'form should'
    ];
    
    return expectationKeywords.some(keyword => lowerStatement.includes(keyword));
  }

  /**
   * Detect action type and extract value with enhanced pattern matching
   * @private
   */
  _detectActionWithValue(instruction) {
    const lowerInst = instruction.toLowerCase();
    let actionType = 'click'; // Default
    let value = '';
    let enhancedDescription = instruction;

    // Navigation actions
    if (lowerInst.includes('go to') || lowerInst.includes('navigate to') || lowerInst.includes('visit')) {
      const urlMatch = instruction.match(/(?:go to|navigate to|visit)\s+([^\s]+)/i);
      if (urlMatch && urlMatch[1].includes('.')) {
        actionType = 'navigate';
        value = urlMatch[1];
        enhancedDescription = `navigate to ${value}`;
      } else {
        // "go to sign" style instructions - treat as click
        actionType = 'click';
        const target = instruction.replace(/go to\s+/i, '').trim();
        enhancedDescription = `click ${target} link or button`;
      }
    }
    
    // Click actions with enhanced patterns
    else if (lowerInst.includes('click') || lowerInst.includes('press') || lowerInst.includes('tap') ||
             lowerInst.includes('select') || lowerInst.includes('choose')) {
      actionType = 'click';
      enhancedDescription = this._enhanceClickInstruction(instruction);
    }
    
    // Type actions with enhanced value extraction
    else if (lowerInst.includes('type') || lowerInst.includes('enter') || lowerInst.includes('fill') ||
             lowerInst.includes('input') || lowerInst.includes('write')) {
      actionType = 'type';
      value = this._extractValueFromInstruction(instruction);
      
      // Enhanced value extraction for email patterns
      if (!value) {
        // Look for patterns like "enter the email vaibhav@example.com"
        const emailMatch = instruction.match(/(?:email|e-mail)\s+([^\s@]+@[^\s@]+\.[^\s]+)/i);
        if (emailMatch) {
          value = emailMatch[1];
        }
        // Look for patterns like "enter email vaibhav"  
        else {
          const afterKeyword = instruction.match(/(?:enter|type|fill|input)\s+(?:the\s+)?(?:email|password|username|name)\s+([^\s]+)/i);
          if (afterKeyword) {
            value = afterKeyword[1];
          }
        }
      }
      
      enhancedDescription = this._enhanceTypeInstruction(instruction, value);
    }
    
    // Scroll actions
    else if (lowerInst.includes('scroll')) {
      actionType = 'scroll';
      if (lowerInst.includes('up')) value = 'up';
      else if (lowerInst.includes('down')) value = 'down';
      else value = 'down'; // Default scroll direction
    }
    
    // Wait actions
    else if (lowerInst.includes('wait') || lowerInst.includes('pause')) {
      actionType = 'wait';
      const timeMatch = instruction.match(/(\d+)\s*(?:ms|milliseconds|s|seconds?)/i);
      value = timeMatch ? timeMatch[1] + (timeMatch[0].includes('ms') ? '' : '000') : '2000';
    }

    // If instruction contains verbs that typically require clicking but no explicit click
    else if (lowerInst.match(/\b(open|access|find|locate|see)\b/)) {
      actionType = 'click';
      enhancedDescription = this._enhanceClickInstruction(instruction);
    }

    return {
      actionType,
      value,
      enhancedDescription
    };
  }

  /**
   * Enhance click instructions for better AI recognition
   * @private
   */
  _enhanceClickInstruction(instruction) {
    const lowerInst = instruction.toLowerCase();
    
    // Common button/link patterns
    if (lowerInst.includes('sign in') || lowerInst.includes('login')) {
      return 'click the sign in button or login link';
    }
    if (lowerInst.includes('sign up') || lowerInst.includes('register')) {
      return 'click the sign up button or register link';
    }
    if (lowerInst.includes('submit') || lowerInst.includes('send')) {
      return 'click the submit button or send button';
    }
    if (lowerInst.includes('search')) {
      return 'click the search button or search icon';
    }
    if (lowerInst.includes('menu') || lowerInst.includes('hamburger')) {
      return 'click the menu button or hamburger icon';
    }
    if (lowerInst.includes('close') || lowerInst.includes('×')) {
      return 'click the close button or X icon';
    }
    
    return instruction;
  }

  /**
   * Enhance type instructions for better AI recognition
   * @private
   */
  _enhanceTypeInstruction(instruction, value) {
    const lowerInst = instruction.toLowerCase();
    
    if (lowerInst.includes('email') || lowerInst.includes('e-mail')) {
      return `type "${value}" into the email input field or username field`;
    }
    if (lowerInst.includes('password') || lowerInst.includes('pass')) {
      return `type "${value}" into the password input field`;
    }
    if (lowerInst.includes('search')) {
      return `type "${value}" into the search input field or search box`;
    }
    if (lowerInst.includes('name')) {
      return `type "${value}" into the name input field`;
    }
    if (lowerInst.includes('phone') || lowerInst.includes('number')) {
      return `type "${value}" into the phone number input field`;
    }
    
    return `type "${value}" into the appropriate input field`;
  }

  /**
   * Check if the input field is for email based on instruction and AI guidance
   * @private
   */
  _isEmailInput(description, aiGuidance) {
    const lowerDescription = (description || '').toLowerCase();
    const elementInfo = aiGuidance.element_info || {};
    const elementDescription = (elementInfo.description || '').toLowerCase();
    const textContent = (elementInfo.text_content || '').toLowerCase();
    
    // Check instruction description
    const descriptionHasEmail = lowerDescription.includes('email') || 
                               lowerDescription.includes('e-mail') ||
                               lowerDescription.includes('username') ||
                               lowerDescription.includes('user id') ||
                               lowerDescription.includes('login id');
    
    // Check AI-detected element information
    const elementHasEmail = elementDescription.includes('email') || 
                           elementDescription.includes('e-mail') ||
                           elementDescription.includes('username') ||
                           textContent.includes('email') ||
                           textContent.includes('username') ||
                           textContent.includes('user id');
    
    // Check element type (if available)
    const isEmailType = elementInfo.element_type === 'input' && 
                       (textContent.includes('@') || 
                        elementDescription.includes('type="email"') ||
                        elementDescription.includes('email'));
    
    const result = descriptionHasEmail || elementHasEmail || isEmailType;
    
    if (result) {
      this.logger.debug('VISUAL-EXECUTOR', 'Detected email input field', {
        description: lowerDescription,
        elementDescription: elementDescription.substring(0, 100),
        textContent: textContent.substring(0, 50),
        elementType: elementInfo.element_type
      });
    }
    
    return result;
  }

  /**
   * Execute a single visual action step using AI guidance with retry logic
   * @private
   */
  async _executeVisualActionStep(stepNumber, actionStep, screenshot, screenSize, options) {
    const startTime = Date.now();
    this.logger.stepStart(stepNumber, actionStep.action, actionStep.description);

    const maxRetries = 3;
    let lastError = null;
    let currentScreenshot = screenshot;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info('VISUAL-EXECUTOR', `Attempt ${attempt}/${maxRetries} for step ${stepNumber}`, {
          action: actionStep.action,
          description: actionStep.description
        });

        // Log screenshot and AI request details
        this.logger.info('VISUAL-EXECUTOR', `📸 Taking screenshot for AI analysis`, {
          screenshotPath: currentScreenshot.path,
          screenshotSize: currentScreenshot.size,
          screenDimensions: `${screenSize.width}x${screenSize.height}`
        });

        this.logger.info('VISUAL-EXECUTOR', `🤖 Requesting AI guidance`, {
          instruction: actionStep.description,
          actionType: actionStep.action,
          expectedValue: actionStep.value || 'none',
          screenSize: `${screenSize.width}x${screenSize.height}`,
          screenshotBase64Length: currentScreenshot.base64 ? currentScreenshot.base64.length : 0
        });

        // Get AI guidance for this action
        const requestStartTime = Date.now();
        this.logger.info('VISUAL-EXECUTOR', '⏳ AI request in progress...', { step: stepNumber });
        
        // Prepare enhanced context for AI
        const enhancedContext = {
          stepNumber: stepNumber,
          formContext: this._detectFormContext(actionStep),
          pageContext: this._detectPageContext(actionStep),
          elementHints: this._buildElementHints(actionStep),
          previousAttempts: this._getPreviousAttempts(stepNumber, attempt)
        };

        const aiGuidance = await this.aiClient.getVisualActionGuidance(
          currentScreenshot,
          actionStep.description,
          screenSize,
          enhancedContext
        );

        const requestDuration = Date.now() - requestStartTime;
        this.logger.info('VISUAL-EXECUTOR', `✅ AI response received`, {
          duration: `${requestDuration}ms`,
          success: aiGuidance.success,
          confidence: aiGuidance.confidence,
          coordinates: aiGuidance.coordinates,
          elementType: aiGuidance.element_info?.element_type,
          reasoning: aiGuidance.reasoning?.substring(0, 150) + (aiGuidance.reasoning?.length > 150 ? '...' : '')
        });

        if (!aiGuidance.success) {
          if (aiGuidance.confidence && aiGuidance.confidence < 0.8) {
            this.logger.warn('VISUAL-EXECUTOR', `Low confidence (${aiGuidance.confidence}), trying alternatives`, {
              reasoning: aiGuidance.reasoning
            });

            // Try alternative actions if available
            if (aiGuidance.alternativeActions && aiGuidance.alternativeActions.length > 0) {
              for (const altAction of aiGuidance.alternativeActions) {
                if (altAction.confidence > 0.7) {
                  this.logger.info('VISUAL-EXECUTOR', 'Trying alternative action', {
                    coordinates: altAction.coordinates,
                    description: altAction.description,
                    confidence: altAction.confidence
                  });

                  const altGuidance = {
                    ...aiGuidance,
                    success: true,
                    coordinates: altAction.coordinates,
                    confidence: altAction.confidence,
                    reasoning: `Using alternative: ${altAction.description}`
                  };

                  await this._performActionAtCoordinates(actionStep, altGuidance);
                  
                  // Success with alternative
                  const duration = Date.now() - startTime;
                  this._recordSuccessfulStep(stepNumber, actionStep, altGuidance, duration, attempt);
                  return;
                }
              }
            }
          }
          
          throw new Error(`AI could not find element (attempt ${attempt}): ${aiGuidance.reasoning}`);
        }

        this.logger.info('VISUAL-EXECUTOR', `🎯 AI found element at coordinates (${aiGuidance.coordinates.x}, ${aiGuidance.coordinates.y})`, {
          elementType: aiGuidance.element_info?.element_type || 'unknown',
          confidence: aiGuidance.confidence,
          reasoning: aiGuidance.reasoning?.substring(0, 100) + '...',
          actionType: aiGuidance.action_type,
          elementDescription: aiGuidance.element_info?.description?.substring(0, 100),
          boundingBox: aiGuidance.element_info?.bounding_box,
          attempt: attempt
        });

        // Execute the action with detailed logging
        this.logger.info('VISUAL-EXECUTOR', `⚡ Executing Appium action`, {
          action: aiGuidance.action_type,
          coordinates: aiGuidance.coordinates,
          inputValue: aiGuidance.input_value || actionStep.value || 'none',
          step: stepNumber,
          attempt: attempt
        });

        const actionStartTime = Date.now();
        await this._performActionAtCoordinates(actionStep, aiGuidance);
        const actionDuration = Date.now() - actionStartTime;

        this.logger.info('VISUAL-EXECUTOR', `✅ Appium action completed`, {
          action: aiGuidance.action_type,
          duration: `${actionDuration}ms`,
          coordinates: aiGuidance.coordinates,
          step: stepNumber
        });

        // Verify action was successful by taking another screenshot
        if (attempt < maxRetries) {
          await this.driver.driver.pause(1000); // Wait for UI to update
          const newScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_attempt_${attempt}_after.png`);
          
          // Quick verification - check if UI changed
          const uiChanged = await this._hasUIChanged(currentScreenshot, newScreenshot);
          if (!uiChanged && aiGuidance.actionType === 'click') {
            this.logger.warn('VISUAL-EXECUTOR', 'UI did not change after click, may need retry');
            currentScreenshot = newScreenshot; // Update screenshot for next attempt
            continue;
          }
        }

        // Success
        const duration = Date.now() - startTime;
        this._recordSuccessfulStep(stepNumber, actionStep, aiGuidance, duration, attempt);
        return;

      } catch (error) {
        lastError = error;
        this.logger.warn('VISUAL-EXECUTOR', `Attempt ${attempt} failed for step ${stepNumber}`, {
          error: error.message
        });

        if (attempt < maxRetries) {
          // Take new screenshot before retry
          await this.driver.driver.pause(1500);
          currentScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_retry_${attempt}.png`);
          
          // Try scrolling if element might be off-screen
          if (error.message.includes('could not find') && attempt === 2) {
            this.logger.info('VISUAL-EXECUTOR', 'Element not found, trying to scroll down');
            await this.driver.scroll('down', 300);
            await this.driver.driver.pause(1000);
            currentScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_after_scroll.png`);
          }
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    const stepResult = {
      stepNumber,
      action: actionStep.action,
      description: actionStep.description,
      success: false,
      duration,
      attempts: maxRetries,
      error: lastError.message
    };

    this.currentTest.steps.push(stepResult);
    this.logger.stepEnd(stepNumber, false, duration, { 
      error: lastError.message, 
      attempts: maxRetries 
    });
    throw lastError;
  }

  /**
   * Record successful step execution
   * @private
   */
  _recordSuccessfulStep(stepNumber, actionStep, aiGuidance, duration, attempt) {
    const stepResult = {
      stepNumber,
      action: actionStep.action,
      description: actionStep.description,
      success: true,
      duration,
      attempts: attempt,
      aiGuidance: {
        coordinates: aiGuidance.coordinates,
        confidence: aiGuidance.confidence,
        elementType: aiGuidance.elementInfo?.element_type,
        reasoning: aiGuidance.reasoning,
        boundingBox: aiGuidance.elementInfo?.bounding_box
      }
    };

    this.currentTest.steps.push(stepResult);
    this.logger.stepEnd(stepNumber, true, duration, {
      coordinates: aiGuidance.coordinates,
      confidence: aiGuidance.confidence,
      attempts: attempt
    });
  }

  /**
   * Check if UI has changed between screenshots (basic comparison)
   * @private
   */
  async _hasUIChanged(screenshot1, screenshot2) {
    // Simple length check - more sophisticated comparison could be added
    if (!screenshot1 || !screenshot2) return true;
    
    const lengthDiff = Math.abs(screenshot1.length - screenshot2.length);
    const threshold = screenshot1.length * 0.01; // 1% difference threshold
    
    return lengthDiff > threshold;
  }

  /**
   * Perform action at AI-determined coordinates
   * @private
   */
  async _performActionAtCoordinates(actionStep, aiGuidance) {
    const { x, y } = aiGuidance.coordinates;
    const boundingBox = aiGuidance.element_info?.bounding_box;

    this.logger.info('VISUAL-EXECUTOR', `🔧 Preparing ${aiGuidance.action_type} action`, {
      coordinates: { x, y },
      boundingBox,
      elementType: aiGuidance.element_info?.element_type,
      confidence: aiGuidance.confidence,
      elementDescription: aiGuidance.element_info?.description?.substring(0, 100)
    });

    const actionType = (aiGuidance.action_type || aiGuidance.actionType || 'click').toLowerCase();
    
    switch (actionType) {
      case 'click':
        this.logger.info('VISUAL-EXECUTOR', `🖱️  Performing click at (${x}, ${y})`);
        await this.driver.clickAtCoordinates(x, y, boundingBox);
        break;

      case 'double-click':
        this.logger.info('VISUAL-EXECUTOR', `🖱️🖱️ Performing double-click at (${x}, ${y})`);
        await this.driver.doubleClickAtCoordinates(x, y);
        break;

      case 'type':
        const textToType = aiGuidance.input_value || aiGuidance.inputValue || actionStep.value || '';
        if (!textToType) {
          throw new Error('No text provided for type action');
        }
        
        this.logger.info('VISUAL-EXECUTOR', `⌨️  Typing text at (${x}, ${y})`, {
          textPreview: textToType.substring(0, 50) + (textToType.length > 50 ? '...' : ''),
          textLength: textToType.length
        });
        
        // Use enhanced email typing for email inputs
        const isEmailInput = this._isEmailInput(actionStep.description, aiGuidance);
        if (isEmailInput) {
          this.logger.info('VISUAL-EXECUTOR', '📧 Using enhanced email typing method');
          await this.driver.typeEmailAtCoordinates(x, y, textToType, {
            boundingBox: aiGuidance.element_info?.bounding_box
          });
        } else {
          await this.driver.typeAtCoordinates(x, y, textToType);
        }
        break;

      case 'scroll':
        const direction = aiGuidance.scroll_direction || aiGuidance.scrollDirection || 'down';
        this.logger.info('VISUAL-EXECUTOR', `📜 Scrolling ${direction} by 300px`);
        await this.driver.scroll(direction, 300);
        break;

      case 'wait':
        const waitTime = parseInt(actionStep.value) || 2000;
        this.logger.info('VISUAL-EXECUTOR', `⏱️  Waiting ${waitTime}ms`);
        await this.driver.driver.pause(waitTime);
        break;

      default:
        this.logger.warn('VISUAL-EXECUTOR', `❓ Unknown action type: ${actionType}, defaulting to click`);
        await this.driver.clickAtCoordinates(x, y, boundingBox);
    }

    // Add small delay after each action
    await this.driver.driver.pause(config.testing.stepDelay);
  }

  /**
   * Perform final visual verification using AI
   * @private
   */
  async _performFinalVisualVerification(instruction, screenshot, options) {
    this.logger.info('VISUAL-EXECUTOR', 'Performing final AI visual verification');

    try {
      const verificationResult = await this.aiClient.verifyScreenshot(
        screenshot,
        `Verify that this instruction was completed successfully: ${instruction}`,
        {
          expectedResult: options.expectedResult,
          context: {
            verificationType: 'final_visual',
            testType: 'ai_guided',
            ...options.context
          }
        }
      );

      this.logger.info('VISUAL-EXECUTOR', 'Final visual verification completed', {
        success: verificationResult.success,
        confidence: verificationResult.confidence
      });

      return verificationResult;

    } catch (error) {
      this.logger.error('VISUAL-EXECUTOR', 'Final visual verification failed', { error: error.message });
      return {
        success: false,
        result: `Verification failed: ${error.message}`,
        confidence: 0.0,
        details: { error: error.message }
      };
    }
  }

  /**
   * Infer action type from instruction text
   * @private
   */
  _inferActionType(instruction) {
    const text = instruction.toLowerCase();
    
    if (text.includes('click') || text.includes('press') || text.includes('tap')) {
      return 'click';
    }
    if (text.includes('type') || text.includes('enter') || text.includes('fill')) {
      return 'type';
    }
    if (text.includes('scroll')) {
      return 'scroll';
    }
    if (text.includes('wait')) {
      return 'wait';
    }
    
    return 'click'; // Default action
  }

  /**
   * Extract value/text from instruction
   * @private
   */
  _extractValueFromInstruction(instruction) {
    // Simple regex to extract quoted text or common patterns
    const quotedMatch = instruction.match(/["'](.*?)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    // Look for "with" patterns
    const withMatch = instruction.match(/with\s+(.+?)(\s+(and|then|$))/i);
    if (withMatch) {
      return withMatch[1].trim();
    }

    return '';
  }

  /**
   * Get test results summary
   * @returns {object} Test results summary
   */
  getTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(test => test.result?.success).length;
    const failedTests = totalTests - passedTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      tests: this.testResults.map(test => ({
        id: test.id,
        instruction: test.instruction,
        success: test.result?.success || false,
        duration: test.result?.duration || 0,
        stepsExecuted: test.steps.length,
        error: test.result?.error
      }))
    };
  }

  /**
   * Detect form context from action step
   * @private
   */
  _detectFormContext(actionStep) {
    const description = actionStep.description?.toLowerCase() || '';
    
    if (description.includes('email') || description.includes('login') || description.includes('sign in')) {
      return 'login_form';
    }
    
    if (description.includes('register') || description.includes('sign up')) {
      return 'registration_form';
    }
    
    if (description.includes('search')) {
      return 'search_form';
    }
    
    return 'unknown_form';
  }

  /**
   * Detect page context from action step
   * @private
   */
  _detectPageContext(actionStep) {
    const description = actionStep.description?.toLowerCase() || '';
    
    if (description.includes('welcome') || description.includes('login') || description.includes('sign in')) {
      return 'login_page';
    }
    
    if (description.includes('dashboard') || description.includes('home')) {
      return 'dashboard_page';
    }
    
    if (description.includes('profile') || description.includes('account')) {
      return 'profile_page';
    }
    
    return 'unknown_page';
  }

  /**
   * Build element hints for AI
   * @private
   */
  _buildElementHints(actionStep) {
    const hints = [];
    const description = actionStep.description?.toLowerCase() || '';
    
    if (description.includes('email')) {
      hints.push({
        type: 'input',
        attributes: ['type="email"', 'name="email"', 'placeholder*="email"'],
        context: 'email_input'
      });
    }
    
    if (description.includes('password')) {
      hints.push({
        type: 'input',
        attributes: ['type="password"', 'name="password"'],
        context: 'password_input'
      });
    }
    
    if (description.includes('button') || description.includes('click')) {
      hints.push({
        type: 'button',
        attributes: ['type="submit"', 'role="button"'],
        context: 'clickable_element'
      });
    }
    
    return hints;
  }

  /**
   * Get previous attempts for this step
   * @private
   */
  _getPreviousAttempts(stepNumber, currentAttempt) {
    // This would ideally track previous failures and their coordinates
    // For now, return empty array - could be enhanced to track actual attempts
    return [];
  }

  /**
   * Execute iterative test workflow
   * @param {string} instruction - Original user instruction
   * @param {object} options - Test execution options
   * @returns {Promise<object>} Test execution result
   */
  async executeIterativeTest(instruction, options = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maxSteps = options.maxSteps || 10;
    const timeout = options.timeout || 300000; // 5 minutes
    const sessionStartTime = Date.now();
    
    this.logger.info('VISUAL-EXECUTOR', '🔄 Starting iterative test execution', {
      sessionId,
      instruction: instruction.substring(0, 100) + '...',
      maxSteps,
      timeout: `${timeout / 1000}s`
    });

    let currentTest = {
      sessionId,
      instruction,
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      screenshots: []
    };

    this.currentTest = currentTest;
    this.driver.setSessionContext({ sessionId, instruction, startTime: sessionStartTime });

    try {
      // Step 1: Take initial screenshot and start session
      const initialScreenshot = await this.driver.takeScreenshot();
      currentTest.screenshots.push({
        step: 0,
        timestamp: new Date().toISOString(),
        screenshot: initialScreenshot
      });

      const screenSize = await this.driver.getScreenSize();
      
      this.logger.info('VISUAL-EXECUTOR', '📋 Starting AI session', {
        sessionId,
        screenSize: `${screenSize.width}x${screenSize.height}`,
        screenshotSize: `${Math.round(initialScreenshot.length / 1024)}KB`
      });

      // Start iterative session with AI
      const sessionConfig = {
        timeout,
        max_steps: maxSteps,
        session_id: sessionId
      };

      const aiSession = await this.aiClient.startIterativeSession(
        instruction,
        initialScreenshot,
        screenSize,
        sessionConfig
      );

      this.logger.info('VISUAL-EXECUTOR', '✅ AI session started', {
        sessionId: aiSession.session_id,
        firstActionType: aiSession.first_action?.action_type,
        firstActionConfidence: aiSession.first_action?.confidence,
        estimatedSteps: aiSession.estimated_total_steps
      });

      // Execute first action
      let currentAction = aiSession.first_action;
      let stepNumber = 1;
      let previousScreenshots = [initialScreenshot];

      while (currentAction && stepNumber <= maxSteps) {
        // Check timeout
        if (Date.now() - sessionStartTime > timeout) {
          throw new Error(`Test execution timeout after ${timeout / 1000}s`);
        }

        this.logger.info('VISUAL-EXECUTOR', `🎯 Executing step ${stepNumber}`, {
          sessionId,
          actionType: currentAction.action_type,
          coordinates: currentAction.coordinates,
          confidence: currentAction.confidence
        });

        // Execute action with detailed logging
        const executionResult = await this.driver.executeActionWithLogging(currentAction);
        
        const stepResult = {
          stepNumber,
          timestamp: new Date().toISOString(),
          action: currentAction,
          result: executionResult.actionResult,
          success: executionResult.actionResult.success,
          duration: executionResult.actionResult.execution_time
        };

        currentTest.steps.push(stepResult);
        
        // Store screenshot
        if (executionResult.screenshotAfter) {
          currentTest.screenshots.push({
            step: stepNumber,
            timestamp: new Date().toISOString(),
            screenshot: executionResult.screenshotAfter
          });
          previousScreenshots.push(executionResult.screenshotAfter);
        }

        this.logger.info('VISUAL-EXECUTOR', `${executionResult.actionResult.success ? '✅' : '❌'} Step ${stepNumber} completed`, {
          sessionId,
          success: executionResult.actionResult.success,
          duration: `${executionResult.actionResult.execution_time.toFixed(2)}s`,
          error: executionResult.actionResult.error_message?.substring(0, 100)
        });

        // Get AI feedback for next action
        this.logger.info('VISUAL-EXECUTOR', '🔄 Getting AI feedback', { sessionId, stepNumber });

        const recentLogs = this.driver.getRecentLogs(5);
        const sessionContext = {
          session_id: aiSession.session_id,
          previous_screenshots: previousScreenshots.slice(-3), // Keep last 3 screenshots for context
          total_steps_executed: stepNumber
        };

        const feedback = await this.aiClient.processIterativeFeedback(
          instruction,
          executionResult.screenshotAfter,
          executionResult.actionResult,
          recentLogs,
          stepNumber + 1,
          screenSize,
          sessionContext
        );

        this.logger.info('VISUAL-EXECUTOR', '📊 AI feedback received', {
          sessionId,
          stepNumber,
          shouldContinue: feedback.should_continue,
          taskCompleted: feedback.task_completed,
          confidence: feedback.confidence,
          nextActionType: feedback.next_action?.action_type,
          issuesFound: feedback.issues_found?.length || 0,
          successIndicators: feedback.success_indicators?.length || 0
        });

        // Check if task is completed
        if (feedback.task_completed) {
          currentTest.status = 'completed';
          currentTest.endTime = new Date().toISOString();
          currentTest.totalSteps = stepNumber;
          
          this.logger.success('VISUAL-EXECUTOR', '🎉 Test completed successfully!', {
            sessionId,
            totalSteps: stepNumber,
            duration: `${((Date.now() - sessionStartTime) / 1000).toFixed(2)}s`,
            successIndicators: feedback.success_indicators
          });

          return {
            success: true,
            sessionId: currentTest.sessionId,
            status: 'completed',
            totalSteps: stepNumber,
            duration: Date.now() - sessionStartTime,
            steps: currentTest.steps,
            screenshots: currentTest.screenshots,
            finalFeedback: feedback,
            message: 'Test completed successfully'
          };
        }

        // Check if we should continue
        if (!feedback.should_continue) {
          currentTest.status = 'stopped';
          currentTest.endTime = new Date().toISOString();
          currentTest.totalSteps = stepNumber;
          currentTest.issues = feedback.issues_found;
          
          this.logger.warn('VISUAL-EXECUTOR', '⚠️ Test stopped by AI recommendation', {
            sessionId,
            totalSteps: stepNumber,
            issues: feedback.issues_found,
            reasoning: feedback.reasoning?.substring(0, 200)
          });

          return {
            success: false,
            sessionId: currentTest.sessionId,
            status: 'stopped',
            totalSteps: stepNumber,
            duration: Date.now() - sessionStartTime,
            steps: currentTest.steps,
            screenshots: currentTest.screenshots,
            issues: feedback.issues_found,
            reasoning: feedback.reasoning,
            message: 'Test stopped due to issues or completion uncertainty'
          };
        }

        // Get next action
        currentAction = feedback.next_action;
        if (!currentAction) {
          this.logger.warn('VISUAL-EXECUTOR', '❌ No next action provided', { sessionId, stepNumber });
          break;
        }

        stepNumber++;
        
        // Add delay between steps
        await new Promise(resolve => setTimeout(resolve, config.testing.stepDelay || 1000));
      }

      // Maximum steps reached
      currentTest.status = 'max_steps_reached';
      currentTest.endTime = new Date().toISOString();
      currentTest.totalSteps = stepNumber - 1;
      
      this.logger.warn('VISUAL-EXECUTOR', '⏱️ Test stopped - maximum steps reached', {
        sessionId,
        maxSteps,
        totalSteps: stepNumber - 1
      });

      return {
        success: false,
        sessionId: currentTest.sessionId,
        status: 'max_steps_reached',
        totalSteps: stepNumber - 1,
        duration: Date.now() - sessionStartTime,
        steps: currentTest.steps,
        screenshots: currentTest.screenshots,
        message: `Test stopped after reaching maximum steps (${maxSteps})`
      };

    } catch (error) {
      currentTest.status = 'error';
      currentTest.endTime = new Date().toISOString();
      currentTest.error = error.message;
      
      this.logger.error('VISUAL-EXECUTOR', '❌ Test execution failed', {
        sessionId,
        error: error.message,
        duration: `${((Date.now() - sessionStartTime) / 1000).toFixed(2)}s`
      });

      return {
        success: false,
        sessionId: currentTest.sessionId,
        status: 'error',
        duration: Date.now() - sessionStartTime,
        steps: currentTest.steps || [],
        screenshots: currentTest.screenshots || [],
        error: error.message,
        message: `Test failed: ${error.message}`
      };
    } finally {
      this.testResults.push(currentTest);
    }
  }

  /**
   * Get current test session status
   * @returns {object} Current test status
   */
  getCurrentTestStatus() {
    if (!this.currentTest) {
      return { status: 'no_active_test' };
    }

    return {
      sessionId: this.currentTest.sessionId,
      status: this.currentTest.status,
      instruction: this.currentTest.instruction,
      currentStep: this.currentTest.steps.length,
      startTime: this.currentTest.startTime,
      endTime: this.currentTest.endTime,
      screenshots: this.currentTest.screenshots.length
    };
  }

  /**
   * Stop current iterative test
   * @returns {Promise<void>}
   */
  async stopIterativeTest() {
    if (!this.currentTest || this.currentTest.status !== 'running') {
      return;
    }

    this.logger.info('VISUAL-EXECUTOR', '🛑 Stopping iterative test', {
      sessionId: this.currentTest.sessionId
    });

    this.currentTest.status = 'stopped_by_user';
    this.currentTest.endTime = new Date().toISOString();
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.info('VISUAL-EXECUTOR', 'Cleaning up visual test executor');

    try {
      await this.driver.quit();
      this.logger.success('VISUAL-EXECUTOR', 'Visual test executor cleanup completed');
    } catch (error) {
      this.logger.warn('VISUAL-EXECUTOR', 'Error during cleanup', { error: error.message });
    }
  }
}

export default VisualTestExecutor;