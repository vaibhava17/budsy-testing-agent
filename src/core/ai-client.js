/**
 * AI Client for Budsy
 * Handles communication with backend LLM service for UI verification
 */

import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

class AIClient {
  constructor() {
    this.baseURL = config.backend.url;
    this.authKey = config.backend.authKey;
    this.webLogger = null; // Will be set by visual test executor if running via web interface
    
    this._setupAxiosClient();
  }

  // Get the appropriate logger (webLogger if available, otherwise default logger)
  get logger() {
    return this.webLogger || logger;
  }

  _setupAxiosClient() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.authKey
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      this.logger.debug('AI-CLIENT', `Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('AI-CLIENT', `Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error('AI-CLIENT', `Request failed: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Verify UI screenshot against instruction
   * @param {string} screenshotBase64 - Base64 encoded screenshot
   * @param {string} instruction - Human instruction for verification
   * @param {object} options - Additional options
   * @returns {Promise<object>} Verification result
   */
  async verifyScreenshot(screenshotBase64, instruction, options = {}) {
    this.logger.aiRequest(config.backend.endpoints.uiVerification, {
      instruction,
      hasScreenshot: !!screenshotBase64
    });

    try {
      const requestData = {
        screenshot_base64: screenshotBase64,
        instruction: instruction,
        expected_result: options.expectedResult,
        context: {
          page: options.page,
          step: options.step,
          timestamp: new Date().toISOString(),
          ...options.context
        }
      };

      const response = await this.client.post(
        config.backend.endpoints.uiVerification,
        requestData
      );

      const result = response.data;
      this.logger.aiResponse(config.backend.endpoints.uiVerification, true, result);

      return {
        success: result.success,
        result: result.result,
        confidence: result.confidence,
        details: result.details || {},
        errors: result.errors || []
      };

    } catch (error) {
      this.logger.aiResponse(config.backend.endpoints.uiVerification, false, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      throw new Error(`AI verification failed: ${error.message}`);
    }
  }

  /**
   * Generate test steps from human instruction
   * @param {string} instruction - Human instruction
   * @param {object} context - Context information
   * @returns {Promise<object>} Generated test steps
   */
  async generateTestSteps(instruction, context = {}) {
    this.logger.aiRequest(config.backend.endpoints.generateSteps, { instruction });

    try {
      const requestData = {
        instruction: instruction,
        context: {
          timestamp: new Date().toISOString(),
          ...context
        }
      };

      const response = await this.client.post(
        config.backend.endpoints.generateSteps,
        requestData
      );

      const result = response.data;
      this.logger.info('AI-CLIENT', `Generated ${result.steps.length} test steps`, {
        instruction: instruction.substring(0, 100) + '...',
        summary: result.summary
      });

      return {
        steps: result.steps,
        summary: result.summary
      };

    } catch (error) {
      this.logger.error('AI-CLIENT', 'Failed to generate test steps', {
        error: error.message,
        status: error.response?.status,
        instruction: instruction.substring(0, 100) + '...'
      });

      throw new Error(`Step generation failed: ${error.message}`);
    }
  }

  /**
   * Check if AI client is properly configured and backend is reachable
   * @returns {Promise<boolean>} True if backend is accessible
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/llm/ui-verification/health');
      const isHealthy = response.data.status === 'healthy';
      
      this.logger.info('AI-CLIENT', `Health check: ${isHealthy ? 'PASSED' : 'FAILED'}`, {
        status: response.data.status,
        service: response.data.service
      });

      return isHealthy;
    } catch (error) {
      this.logger.error('AI-CLIENT', 'Health check failed', {
        error: error.message,
        baseURL: this.baseURL
      });
      return false;
    }
  }

  /**
   * Get AI-guided action coordinates from screenshot
   * @param {string} screenshotBase64 - Base64 encoded screenshot
   * @param {string} instruction - Action instruction (e.g., "click sign in button")
   * @param {object} screenSize - Screen dimensions {width, height}
   * @param {object} options - Additional options
   * @returns {Promise<object>} Action guidance with coordinates
   */
  async getVisualActionGuidance(screenshotBase64, instruction, screenSize = null, options = {}) {
    const requestStartTime = Date.now();
    
    this.logger.aiRequest(config.backend.endpoints.visualAction, {
      instruction: instruction.substring(0, 100) + (instruction.length > 100 ? '...' : ''),
      hasScreenshot: !!screenshotBase64,
      screenshotSize: screenshotBase64 ? `${Math.round(screenshotBase64.length / 1024)}KB` : 'none',
      screenSize: screenSize ? `${screenSize.width}x${screenSize.height}` : 'unknown'
    });

    try {
      const requestData = {
        screenshot_base64: screenshotBase64,
        instruction: instruction,
        screen_size: screenSize,
        confidence_threshold: options.confidenceThreshold || 0.8
      };

      this.logger.info('AI-CLIENT', '📤 Sending visual action request to AI backend', {
        endpoint: config.backend.endpoints.visualAction,
        instructionLength: instruction.length,
        screenshotLength: screenshotBase64 ? screenshotBase64.length : 0,
        requestSizeKB: Math.round(JSON.stringify(requestData).length / 1024)
      });

      const response = await this.client.post(
        config.backend.endpoints.visualAction,
        requestData
      );

      const requestDuration = Date.now() - requestStartTime;
      const result = response.data;
      
      this.logger.aiResponse(config.backend.endpoints.visualAction, true, {
        success: result.success,
        action_type: result.action_type,
        coordinates: result.coordinates,
        confidence: result.confidence,
        duration: `${requestDuration}ms`
      });

      this.logger.info('AI-CLIENT', '📥 Received AI visual action response', {
        success: result.success,
        actionType: result.action_type,
        coordinates: result.coordinates,
        confidence: result.confidence,
        elementType: result.element_info?.element_type,
        elementDescription: result.element_info?.description?.substring(0, 100),
        reasoning: result.reasoning?.substring(0, 200) + (result.reasoning?.length > 200 ? '...' : ''),
        duration: `${requestDuration}ms`,
        responseSize: `${Math.round(JSON.stringify(result).length / 1024)}KB`
      });

      return {
        success: result.success,
        // Provide both formats for backward compatibility
        action_type: result.action_type,
        actionType: result.action_type,
        coordinates: result.coordinates,
        element_info: result.element_info,
        elementInfo: result.element_info,
        confidence: result.confidence,
        reasoning: result.reasoning,
        alternative_actions: result.alternative_actions || [],
        alternativeActions: result.alternative_actions || [],
        input_value: result.input_value,
        inputValue: result.input_value,
        scroll_direction: result.scroll_direction,
        scrollDirection: result.scroll_direction,
        wait_condition: result.wait_condition,
        waitCondition: result.wait_condition,
        error: result.error
      };

    } catch (error) {
      this.logger.aiResponse(config.backend.endpoints.visualAction, false, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      throw new Error(`Visual action guidance failed: ${error.message}`);
    }
  }

  /**
   * Start an iterative test session
   * @param {string} instruction - Original user instruction  
   * @param {string} screenshotBase64 - Initial screenshot
   * @param {object} screenSize - Screen dimensions
   * @param {object} sessionConfig - Session configuration
   * @returns {Promise<object>} Session response with ID and first action
   */
  async startIterativeSession(instruction, screenshotBase64, screenSize, sessionConfig = {}) {
    this.logger.aiRequest(config.backend.endpoints.startSession, {
      instruction: instruction.substring(0, 100) + (instruction.length > 100 ? '...' : ''),
      hasScreenshot: !!screenshotBase64,
      screenSize: screenSize ? `${screenSize.width}x${screenSize.height}` : 'unknown'
    });

    try {
      const requestData = {
        original_instruction: instruction,
        initial_screenshot: screenshotBase64,
        screen_size: screenSize,
        session_config: sessionConfig,
        timeout: sessionConfig.timeout || 300
      };

      const response = await this.client.post(
        config.backend.endpoints.startSession,
        requestData
      );

      const result = response.data;
      this.logger.info('AI-CLIENT', `✅ Test session started`, {
        sessionId: result.session_id,
        firstAction: result.first_action?.action_type,
        estimatedSteps: result.estimated_total_steps,
        expiresAt: result.session_expires_at
      });

      return result;

    } catch (error) {
      this.logger.error('AI-CLIENT', 'Failed to start iterative session', {
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Session start failed: ${error.message}`);
    }
  }

  /**
   * Process iterative feedback and get next action
   * @param {string} originalInstruction - Original task instruction
   * @param {string} currentScreenshot - Current screenshot after action
   * @param {object} previousAction - Details of previous action executed
   * @param {array} appiumLogs - Appium execution logs
   * @param {number} stepNumber - Current step number
   * @param {object} screenSize - Screen dimensions
   * @param {object} sessionContext - Additional session context
   * @returns {Promise<object>} Feedback response with next action or completion
   */
  async processIterativeFeedback(originalInstruction, currentScreenshot, previousAction, appiumLogs, stepNumber, screenSize, sessionContext = {}) {
    const requestStartTime = Date.now();
    
    this.logger.aiRequest(config.backend.endpoints.iterativeFeedback, {
      originalInstruction: originalInstruction.substring(0, 100) + '...',
      stepNumber,
      previousActionType: previousAction.action_type,
      previousActionSuccess: previousAction.success,
      logsCount: appiumLogs.length
    });

    try {
      const requestData = {
        original_instruction: originalInstruction,
        current_screenshot: currentScreenshot,
        previous_action: {
          action_type: previousAction.action_type,
          success: previousAction.success,
          coordinates: previousAction.coordinates,
          input_value: previousAction.input_value,
          error_message: previousAction.error_message,
          execution_time: previousAction.execution_time || 0,
          element_found: previousAction.element_found || false,
          screenshot_after: currentScreenshot
        },
        appium_logs: appiumLogs.map(log => ({
          command: log.command || log.action || 'unknown',
          status: log.status || (log.success ? 'success' : 'failed'),
          response_time: log.response_time || log.duration || 0,
          session_id: log.session_id,
          error_details: log.error_details || log.error,
          element_info: log.element_info
        })),
        step_number: stepNumber,
        session_context: sessionContext,
        screen_size: screenSize,
        previous_screenshots: sessionContext.previous_screenshots || []
      };

      this.logger.info('AI-CLIENT', '📤 Sending iterative feedback to AI', {
        endpoint: config.backend.endpoints.iterativeFeedback,
        stepNumber,
        previousActionType: previousAction.action_type,
        previousSuccess: previousAction.success,
        screenshotSize: `${Math.round(currentScreenshot.length / 1024)}KB`,
        logsCount: appiumLogs.length,
        requestSizeKB: Math.round(JSON.stringify(requestData).length / 1024)
      });

      const response = await this.client.post(
        config.backend.endpoints.iterativeFeedback,
        requestData
      );

      const requestDuration = Date.now() - requestStartTime;
      const result = response.data;
      
      this.logger.aiResponse(config.backend.endpoints.iterativeFeedback, true, {
        shouldContinue: result.should_continue,
        taskCompleted: result.task_completed,
        confidence: result.confidence,
        nextActionType: result.next_action?.action_type,
        duration: `${requestDuration}ms`
      });

      this.logger.info('AI-CLIENT', '📥 Received iterative feedback', {
        shouldContinue: result.should_continue,
        taskCompleted: result.task_completed,
        progressAssessment: result.progress_assessment?.substring(0, 150),
        nextActionType: result.next_action?.action_type,
        nextCoordinates: result.next_action?.coordinates,
        confidence: result.confidence,
        issuesCount: result.issues_found?.length || 0,
        successIndicatorsCount: result.success_indicators?.length || 0,
        estimatedStepsRemaining: result.estimated_steps_remaining,
        duration: `${requestDuration}ms`
      });

      return {
        should_continue: result.should_continue,
        task_completed: result.task_completed,
        next_action: result.next_action,
        progress_assessment: result.progress_assessment,
        issues_found: result.issues_found || [],
        success_indicators: result.success_indicators || [],
        confidence: result.confidence,
        reasoning: result.reasoning,
        estimated_steps_remaining: result.estimated_steps_remaining
      };

    } catch (error) {
      this.logger.aiResponse(config.backend.endpoints.iterativeFeedback, false, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      throw new Error(`Iterative feedback failed: ${error.message}`);
    }
  }

  /**
   * Get service information
   * @returns {Promise<object>} Service info
   */
  async getServiceInfo() {
    try {
      const response = await this.client.get('/llm/ui-verification/');
      return response.data;
    } catch (error) {
      this.logger.error('AI-CLIENT', 'Failed to get service info', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export const aiClient = new AIClient();
export default aiClient;