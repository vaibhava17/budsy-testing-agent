/**
 * Test Executor for Budsy
 * Main execution engine that combines Appium driver with AI verification
 */

import AppiumDriverManager from './appium-driver.js';
import aiClient from './ai-client.js';
import logger from './logger.js';
import config from '../config/index.js';

class TestExecutor {
  constructor() {
    this.driver = new AppiumDriverManager();
    this.aiClient = aiClient;
    this.testResults = [];
    this.currentTest = null;
  }

  /**
   * Initialize test executor
   * @param {object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    logger.info('EXECUTOR', 'Initializing test executor');

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

      logger.success('EXECUTOR', 'Test executor initialized successfully');

    } catch (error) {
      logger.error('EXECUTOR', 'Failed to initialize test executor', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute test from human instruction
   * @param {string} instruction - Human-readable test instruction
   * @param {object} options - Execution options
   * @returns {Promise<object>} Test execution result
   */
  async executeInstruction(instruction, options = {}) {
    const testId = `test_${Date.now()}`;
    const startTime = Date.now();

    this.currentTest = {
      id: testId,
      instruction,
      startTime,
      steps: [],
      screenshots: [],
      result: null
    };

    logger.testStart(instruction, { testId });

    try {
      // Generate test steps from instruction
      logger.info('EXECUTOR', 'Generating test steps from instruction');
      const stepsResponse = await this.aiClient.generateTestSteps(instruction, options.context);
      
      logger.info('EXECUTOR', `Generated ${stepsResponse.steps.length} test steps`, {
        summary: stepsResponse.summary
      });

      // Execute each step
      for (let i = 0; i < stepsResponse.steps.length; i++) {
        const step = stepsResponse.steps[i];
        const stepNumber = i + 1;
        
        await this._executeStep(stepNumber, step, options);
      }

      // Final verification if requested
      if (options.finalVerification) {
        await this._performFinalVerification(instruction, options);
      }

      const duration = Date.now() - startTime;
      this.currentTest.result = { success: true, duration };
      this.testResults.push(this.currentTest);

      logger.testEnd(instruction, true, duration, {
        stepsExecuted: stepsResponse.steps.length,
        screenshotsTaken: this.currentTest.screenshots.length
      });

      return {
        success: true,
        testId,
        instruction,
        stepsExecuted: stepsResponse.steps.length,
        duration,
        screenshots: this.currentTest.screenshots,
        steps: this.currentTest.steps
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.currentTest.result = { success: false, error: error.message, duration };
      this.testResults.push(this.currentTest);

      logger.testEnd(instruction, false, duration, { error: error.message });

      throw error;
    }
  }

  /**
   * Execute test with AI-powered verification
   * @param {string} instruction - Test instruction
   * @param {string} url - Target URL (for web tests)
   * @param {object} options - Execution options
   * @returns {Promise<object>} Test execution result with AI verification
   */
  async executeWithVerification(instruction, url = null, options = {}) {
    logger.info('EXECUTOR', 'Starting test with AI verification', { 
      instruction: instruction.substring(0, 100) + '...',
      url 
    });

    try {
      // Navigate to URL if provided (web only)
      if (url) {
        await this.driver.navigateTo(url);
      }

      // Execute the test instruction
      const executionResult = await this.executeInstruction(instruction, {
        ...options,
        finalVerification: true
      });

      // Take final screenshot for verification
      const finalScreenshot = await this.driver.takeScreenshot('final_verification.png');

      // AI verification of the final result
      logger.info('EXECUTOR', 'Performing AI verification of test result');
      const verificationResult = await this.aiClient.verifyScreenshot(
        finalScreenshot,
        `Verify that the following instruction was completed successfully: ${instruction}`,
        {
          expectedResult: options.expectedResult,
          page: url,
          context: {
            testType: 'full_instruction',
            ...options.context
          }
        }
      );

      // Combine execution and verification results
      const testResult = {
        ...executionResult,
        verification: {
          success: verificationResult.success,
          result: verificationResult.result,
          confidence: verificationResult.confidence,
          details: verificationResult.details
        },
        finalScreenshot: finalScreenshot
      };

      logger.success('EXECUTOR', 'Test completed with AI verification', {
        executionSuccess: executionResult.success,
        verificationSuccess: verificationResult.success,
        confidence: verificationResult.confidence
      });

      return testResult;

    } catch (error) {
      logger.error('EXECUTOR', 'Test with verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a single test step
   * @param {number} stepNumber - Step number
   * @param {object} step - Step definition
   * @param {object} options - Execution options
   * @returns {Promise<void>}
   */
  async _executeStep(stepNumber, step, options = {}) {
    const startTime = Date.now();
    logger.stepStart(stepNumber, step.action, step.description);

    try {
      // Take screenshot before step (if enabled)
      let beforeScreenshot = null;
      if (options.screenshotBeforeStep) {
        beforeScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_before.png`);
      }

      // Execute step based on action type
      switch (step.action.toLowerCase()) {
        case 'navigate':
          await this.driver.navigateTo(step.value);
          break;

        case 'click':
          await this.driver.clickElement(step.locator);
          break;

        case 'type':
          await this.driver.typeText(step.locator, step.value);
          break;

        case 'wait':
          if (step.locator) {
            await this.driver.waitForElement(step.locator);
          } else {
            await this.driver.driver.pause(parseInt(step.value) || 1000);
          }
          break;

        case 'verify':
          await this._verifyStep(step, stepNumber, options);
          break;

        default:
          throw new Error(`Unknown step action: ${step.action}`);
      }

      // Take screenshot after step
      const afterScreenshot = await this.driver.takeScreenshot(`step_${stepNumber}_after.png`);

      const duration = Date.now() - startTime;
      const stepResult = {
        stepNumber,
        action: step.action,
        description: step.description,
        success: true,
        duration,
        beforeScreenshot,
        afterScreenshot
      };

      this.currentTest.steps.push(stepResult);
      this.currentTest.screenshots.push(afterScreenshot);

      logger.stepEnd(stepNumber, true, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      const stepResult = {
        stepNumber,
        action: step.action,
        description: step.description,
        success: false,
        duration,
        error: error.message
      };

      this.currentTest.steps.push(stepResult);
      logger.stepEnd(stepNumber, false, duration, { error: error.message });
      throw error;
    }
  }

  /**
   * Verify a step using AI vision
   * @param {object} step - Step definition
   * @param {number} stepNumber - Step number
   * @param {object} options - Verification options
   * @returns {Promise<void>}
   */
  async _verifyStep(step, stepNumber, options = {}) {
    logger.info('EXECUTOR', `AI verification for step ${stepNumber}`, {
      expected: step.expected,
      locator: step.locator
    });

    // Take screenshot for verification
    const screenshot = await this.driver.takeScreenshot(`step_${stepNumber}_verify.png`);

    // Prepare verification instruction
    let verificationInstruction = step.expected || step.description;
    if (step.locator) {
      verificationInstruction += ` (check element: ${step.locator})`;
    }

    // Perform AI verification
    const verificationResult = await this.aiClient.verifyScreenshot(
      screenshot,
      verificationInstruction,
      {
        step: stepNumber,
        context: {
          stepAction: step.action,
          locator: step.locator,
          ...options.context
        }
      }
    );

    if (!verificationResult.success) {
      throw new Error(`Step verification failed: ${verificationResult.result}`);
    }

    logger.success('EXECUTOR', `Step ${stepNumber} verification passed`, {
      confidence: verificationResult.confidence,
      result: verificationResult.result.substring(0, 100) + '...'
    });
  }

  /**
   * Perform final AI verification of test completion
   * @param {string} instruction - Original test instruction
   * @param {object} options - Verification options
   * @returns {Promise<void>}
   */
  async _performFinalVerification(instruction, options = {}) {
    logger.info('EXECUTOR', 'Performing final AI verification');

    const finalScreenshot = await this.driver.takeScreenshot('final_verification.png');

    const verificationResult = await this.aiClient.verifyScreenshot(
      finalScreenshot,
      `Verify that this instruction was completed successfully: ${instruction}`,
      {
        expectedResult: options.expectedResult,
        context: {
          verificationType: 'final',
          ...options.context
        }
      }
    );

    if (!verificationResult.success) {
      throw new Error(`Final verification failed: ${verificationResult.result}`);
    }

    logger.success('EXECUTOR', 'Final verification passed', {
      confidence: verificationResult.confidence
    });
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
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    logger.info('EXECUTOR', 'Cleaning up test executor');

    try {
      await this.driver.quit();
      logger.success('EXECUTOR', 'Test executor cleanup completed');
    } catch (error) {
      logger.warn('EXECUTOR', 'Error during cleanup', { error: error.message });
    }
  }
}

export default TestExecutor;