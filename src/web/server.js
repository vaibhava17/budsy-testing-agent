#!/usr/bin/env node

/**
 * Budsy Web Interface Server
 * Express server with WebSocket support for real-time test execution and logging
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import archiver from 'archiver';
import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';

import TestExecutor from '../core/test-executor.js';
import VisualTestExecutor from '../core/visual-test-executor.js';
import config from '../config/index.js';
import logger from '../core/logger.js';
import aiClient from '../core/ai-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BudsyWebServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.port = process.env.WEB_PORT || 3000;
    this.activeTests = new Map(); // Store active test sessions
    this.logWatchers = new Map(); // Store file watchers
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Serve static files from web directory
    this.app.use(express.static(path.join(__dirname, 'static')));
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const executor = new TestExecutor();
        const aiHealthy = await executor.aiClient.healthCheck();
        
        res.json({
          status: 'healthy',
          services: {
            web: true,
            ai_backend: aiHealthy,
            appium: true // Basic check, could be enhanced
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // Get configuration
    this.app.get('/api/config', (req, res) => {
      res.json({
        backend: {
          url: config.backend.url,
          hasAuthKey: !!config.backend.authKey
        },
        appium: {
          serverUrl: config.appium.serverUrl
        },
        screenshots: {
          dir: config.screenshots.dir,
          save: config.screenshots.save
        },
        testing: {
          defaultTimeout: config.testing.defaultTimeout,
          stepDelay: config.testing.stepDelay
        }
      });
    });

    // Start test execution
    this.app.post('/api/tests/start', async (req, res) => {
      try {
        const { instruction, url, platform = 'web', expectedResult, options = {}, testMode = 'visual' } = req.body;
        
        if (!instruction) {
          return res.status(400).json({ error: 'Test instruction is required' });
        }

        const testId = uuidv4();
        const testSession = {
          id: testId,
          instruction,
          url,
          platform,
          expectedResult,
          options,
          testMode, // 'visual' for AI-guided, 'traditional' for selector-based
          status: 'starting',
          startTime: new Date(),
          logs: []
        };

        this.activeTests.set(testId, testSession);

        // Start test execution in background
        this.executeTest(testId, testSession);

        res.json({
          testId,
          status: 'started',
          message: `Test execution started (${testMode} mode)`,
          testMode
        });

      } catch (error) {
        logger.error('WEB-SERVER', 'Failed to start test', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Get test status
    this.app.get('/api/tests/:testId', (req, res) => {
      const { testId } = req.params;
      const testSession = this.activeTests.get(testId);
      
      if (!testSession) {
        return res.status(404).json({ error: 'Test not found' });
      }

      res.json({
        id: testSession.id,
        status: testSession.status,
        instruction: testSession.instruction,
        platform: testSession.platform,
        startTime: testSession.startTime,
        endTime: testSession.endTime,
        duration: testSession.duration,
        result: testSession.result,
        error: testSession.error,
        logs: testSession.logs.slice(-50) // Return last 50 log entries
      });
    });

    // Stop test execution
    this.app.post('/api/tests/:testId/stop', (req, res) => {
      const { testId } = req.params;
      const testSession = this.activeTests.get(testId);
      
      if (!testSession) {
        return res.status(404).json({ error: 'Test not found' });
      }

      if (testSession.executor) {
        testSession.executor.cleanup();
      }

      testSession.status = 'stopped';
      testSession.endTime = new Date();

      this.io.to(testId).emit('test_stopped', { testId });

      res.json({ message: 'Test stopped' });
    });

    // Download logs
    this.app.get('/api/tests/:testId/logs/download', async (req, res) => {
      try {
        const { testId } = req.params;
        const testSession = this.activeTests.get(testId);
        
        if (!testSession) {
          return res.status(404).json({ error: 'Test not found' });
        }

        const archive = archiver('zip', { zlib: { level: 9 } });
        const filename = `budsy_logs_${testId}_${Date.now()}.zip`;

        res.attachment(filename);
        archive.pipe(res);

        // Add test session data
        archive.append(JSON.stringify(testSession, null, 2), { name: 'test_session.json' });

        // Add logs
        const logContent = testSession.logs.map(log => 
          `[${log.timestamp}] [${log.level}] [${log.component}] ${log.message} ${log.data ? '| ' + JSON.stringify(log.data) : ''}`
        ).join('\n');
        archive.append(logContent, { name: 'test_execution.log' });

        // Add screenshots if available
        if (testSession.screenshots && testSession.screenshots.length > 0) {
          for (let i = 0; i < testSession.screenshots.length; i++) {
            const screenshot = testSession.screenshots[i];
            if (screenshot.path && await this.fileExists(screenshot.path)) {
              archive.file(screenshot.path, { name: `screenshots/screenshot_${i + 1}.png` });
            }
          }
        }

        // Add main log file
        if (await this.fileExists(config.logging.file)) {
          archive.file(config.logging.file, { name: 'budsy_main.log' });
        }

        await archive.finalize();

      } catch (error) {
        logger.error('WEB-SERVER', 'Failed to create log archive', { error: error.message });
        res.status(500).json({ error: 'Failed to create log archive' });
      }
    });

    // Get active tests
    this.app.get('/api/tests', (req, res) => {
      const tests = Array.from(this.activeTests.values()).map(test => ({
        id: test.id,
        instruction: test.instruction,
        platform: test.platform,
        status: test.status,
        startTime: test.startTime,
        endTime: test.endTime,
        duration: test.duration
      }));

      res.json(tests);
    });

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      logger.info('WEB-SERVER', 'Client connected', { socketId: socket.id });

      socket.on('join_test', (testId) => {
        socket.join(testId);
        logger.debug('WEB-SERVER', 'Client joined test room', { 
          socketId: socket.id, 
          testId 
        });
      });

      socket.on('leave_test', (testId) => {
        socket.leave(testId);
        logger.debug('WEB-SERVER', 'Client left test room', { 
          socketId: socket.id, 
          testId 
        });
      });

      socket.on('disconnect', () => {
        logger.info('WEB-SERVER', 'Client disconnected', { socketId: socket.id });
      });
    });
  }

  async executeTest(testId, testSession) {
    let executor = null;

    try {
      testSession.status = 'initializing';
      this.io.to(testId).emit('test_status', { testId, status: 'initializing' });

      // Create custom logger that emits to WebSocket
      const webLogger = this.createWebLogger(testId);

      // Initialize executor based on test mode
      if (testSession.testMode === 'visual') {
        executor = new VisualTestExecutor();
        webLogger.info('EXECUTOR', 'Using AI-guided visual test executor');
      } else {
        executor = new TestExecutor();
        webLogger.info('EXECUTOR', 'Using traditional selector-based test executor');
      }
      
      testSession.executor = executor;

      // Override executor logger to capture logs
      this.interceptExecutorLogs(executor, webLogger);

      webLogger.info('EXECUTOR', 'Initializing test executor');

      await executor.initialize({
        platform: testSession.platform,
        driver: {
          capabilities: testSession.platform === 'web' ? {
            browserName: 'chrome'
          } : testSession.options.capabilities || {}
        }
      });

      testSession.status = 'running';
      this.io.to(testId).emit('test_status', { testId, status: 'running' });

      webLogger.info('EXECUTOR', 'Starting test execution', { 
        instruction: testSession.instruction.substring(0, 100) + '...',
        mode: testSession.testMode
      });

      // Execute test based on mode
      let result;
      if (testSession.testMode === 'iterative') {
        result = await this.executeIterativeTest(executor, testSession, webLogger);
      } else if (testSession.testMode === 'visual') {
        result = await executor.executeVisualTest(
          testSession.instruction,
          testSession.url,
          {
            expectedResult: testSession.expectedResult,
            context: {
              testId,
              platform: testSession.platform,
              testMode: 'visual_web_interface',
              ...testSession.options.context
            }
          }
        );
      } else {
        result = await executor.executeWithVerification(
          testSession.instruction,
          testSession.url,
          {
            expectedResult: testSession.expectedResult,
            screenshotBeforeStep: true,
            context: {
              testId,
              platform: testSession.platform,
              testMode: 'traditional_web_interface',
              ...testSession.options.context
            }
          }
        );
      }

      testSession.status = 'completed';
      testSession.result = result;
      testSession.endTime = new Date();
      testSession.duration = testSession.endTime - testSession.startTime;

      // Store screenshots info
      if (result.screenshots) {
        testSession.screenshots = result.screenshots.map((screenshot, index) => ({
          index,
          timestamp: new Date(),
          path: path.join(config.screenshots.dir, `test_${testId}_${index}.png`)
        }));
      }

      webLogger.success('EXECUTOR', 'Test completed successfully', {
        duration: testSession.duration,
        stepsExecuted: result.stepsExecuted,
        verificationSuccess: result.verification?.success
      });

      this.io.to(testId).emit('test_completed', {
        testId,
        result: {
          success: result.verification?.success || false,
          stepsExecuted: result.stepsExecuted,
          duration: testSession.duration,
          verification: result.verification,
          screenshots: testSession.screenshots?.length || 0
        }
      });

    } catch (error) {
      testSession.status = 'failed';
      testSession.error = error.message;
      testSession.endTime = new Date();
      testSession.duration = testSession.endTime - testSession.startTime;

      const webLogger = this.createWebLogger(testId);
      webLogger.error('EXECUTOR', 'Test execution failed', { 
        error: error.message,
        duration: testSession.duration
      });

      this.io.to(testId).emit('test_failed', {
        testId,
        error: error.message,
        duration: testSession.duration
      });

      // Automatically create and emit log archive on failure
      this.createFailureLogArchive(testId, testSession);

    } finally {
      if (executor) {
        try {
          await executor.cleanup();
        } catch (cleanupError) {
          logger.warn('WEB-SERVER', 'Cleanup error', { error: cleanupError.message });
        }
      }
    }
  }

  createWebLogger(testId) {
    return {
      info: (component, message, data = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          component,
          message,
          data
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.info(component, message, data);
      },
      
      error: (component, message, data = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'error',
          component,
          message,
          data
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.error(component, message, data);
      },
      
      success: (component, message, data = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'success',
          component,
          message,
          data
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.success(component, message, data);
      },

      debug: (component, message, data = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'debug',
          component,
          message,
          data
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.debug(component, message, data);
      },

      warn: (component, message, data = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'warn',
          component,
          message,
          data
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.warn(component, message, data);
      },

      // Specialized logging methods to match the file-based logger
      testStart: (testName, details = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'TEST',
          message: `🚀 Starting test: ${testName}`,
          data: details
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.testStart(testName, details);
      },

      testEnd: (testName, success, duration, details = {}) => {
        const status = success ? '✅ PASSED' : '❌ FAILED';
        const message = `${status}: ${testName} (${duration}ms)`;
        
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: success ? 'success' : 'error',
          component: 'TEST',
          message,
          data: details
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.testEnd(testName, success, duration, details);
      },

      stepStart: (stepNumber, action, description) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'STEP',
          message: `📋 Step ${stepNumber}: ${action} - ${description}`,
          data: { stepNumber, action, description }
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.stepStart(stepNumber, action, description);
      },

      stepEnd: (stepNumber, success, duration, details = {}) => {
        const status = success ? '✅' : '❌';
        const message = `${status} Step ${stepNumber} completed (${duration}ms)`;
        
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: success ? 'success' : 'error',
          component: 'STEP',
          message,
          data: { stepNumber, success, duration, ...details }
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.stepEnd(stepNumber, success, duration, details);
      },

      aiRequest: (endpoint, requestData = {}) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'debug',
          component: 'AI',
          message: `📤 Request to ${endpoint}`,
          data: { 
            instruction: requestData.instruction?.substring(0, 100) + (requestData.instruction?.length > 100 ? '...' : ''),
            hasScreenshot: !!requestData.screenshot_base64,
            endpoint
          }
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.aiRequest(endpoint, requestData);
      },

      aiResponse: (endpoint, success, responseData = {}) => {
        const message = success 
          ? `📥 Response from ${endpoint}` 
          : `💥 Failed response from ${endpoint}`;
          
        const logEntry = {
          timestamp: new Date().toISOString(),
          level: success ? 'info' : 'error',
          component: 'AI',
          message,
          data: success ? {
            success: responseData.success,
            confidence: responseData.confidence,
            result: responseData.result?.substring(0, 100) + (responseData.result?.length > 100 ? '...' : ''),
            endpoint
          } : { ...responseData, endpoint }
        };
        
        const testSession = this.activeTests.get(testId);
        if (testSession) {
          testSession.logs.push(logEntry);
        }

        this.io.to(testId).emit('log', logEntry);
        logger.aiResponse(endpoint, success, responseData);
      }
    };
  }

  interceptExecutorLogs(executor, webLogger) {
    // This would require modifying the executor to accept a custom logger
    // For now, we'll use the existing logger and capture via the webLogger
    executor.webLogger = webLogger;
  }

  async createFailureLogArchive(testId, testSession) {
    try {
      const archivePath = path.join(config.paths.logs, `failure_${testId}_${Date.now()}.zip`);
      const { createWriteStream } = await import('fs');
      const output = createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        this.io.to(testId).emit('failure_logs_ready', {
          testId,
          archivePath,
          size: archive.pointer()
        });
      });

      archive.pipe(output);

      // Add test session data
      archive.append(JSON.stringify(testSession, null, 2), { name: 'test_session.json' });

      // Add logs
      const logContent = testSession.logs.map(log => 
        `[${log.timestamp}] [${log.level}] [${log.component}] ${log.message} ${log.data ? '| ' + JSON.stringify(log.data) : ''}`
      ).join('\n');
      archive.append(logContent, { name: 'test_execution.log' });

      // Add main log file if exists
      if (await this.fileExists(config.logging.file)) {
        archive.file(config.logging.file, { name: 'budsy_main.log' });
      }

      await archive.finalize();

    } catch (error) {
      logger.error('WEB-SERVER', 'Failed to create failure log archive', { 
        testId, 
        error: error.message 
      });
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.success('WEB-SERVER', `Budsy web interface started`, {
          port: this.port,
          url: `http://localhost:${this.port}`
        });
        resolve();
      });
    });
  }

  async stop() {
    // Cleanup active tests
    for (const [testId, testSession] of this.activeTests) {
      if (testSession.executor) {
        await testSession.executor.cleanup();
      }
    }

    // Stop file watchers
    for (const watcher of this.logWatchers.values()) {
      await watcher.close();
    }

    this.server.close();
    logger.info('WEB-SERVER', 'Budsy web interface stopped');
  }

  async executeIterativeTest(executor, testSession, webLogger) {
    const maxSteps = 10; // Prevent infinite loops
    let stepCount = 0;
    
    webLogger.info('ITERATIVE', `🔄 Starting iterative test: ${testSession.instruction}`);
    webLogger.info('ITERATIVE', `Platform: ${testSession.platform}, URL: ${testSession.url}`);
    
    try {
      // Initialize for the target URL
      if (testSession.url) {
        await executor.navigateToUrl(testSession.url);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page load
      }

      while (stepCount < maxSteps) {
        stepCount++;
        webLogger.info('STEP', `--- Step ${stepCount} ---`);
        
        // Step 1: Take screenshot and get AI action
        webLogger.info('AI', '📸 Taking screenshot and getting AI action...');
        const screenshot = await executor.takeScreenshot();
        const screenshotBase64 = screenshot.toString('base64');
        
        // Set web logger for AI client
        aiClient.webLogger = webLogger;
        
        const aiResponse = await aiClient.getVisualActionGuidance(
          screenshotBase64, 
          testSession.instruction,
          { width: 1280, height: 720 }
        );
        
        if (!aiResponse.success || !aiResponse.action_type) {
          webLogger.success('AI', '✅ No more actions needed. Test completed!');
          break;
        }
        
        webLogger.info('AI', `🤖 AI Action: ${aiResponse.action_type} - ${aiResponse.element_info?.description || ''}`);
        
        // Step 2: Execute action with Appium and capture logs
        webLogger.info('APPIUM', '🚀 Executing action with Appium...');
        const actionStartTime = Date.now();
        let actionSuccess = false;
        let actionError = null;
        
        try {
          await executor.performAction(aiResponse);
          actionSuccess = true;
          webLogger.success('APPIUM', '✅ Action executed successfully');
        } catch (error) {
          actionError = error.message;
          webLogger.error('APPIUM', `❌ Action execution failed: ${error.message}`);
        }
        
        const actionExecutionTime = Date.now() - actionStartTime;
        
        // Step 3: Take screenshot after action and get feedback
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for UI to update
        const afterScreenshot = await executor.takeScreenshot();
        const afterScreenshotBase64 = afterScreenshot.toString('base64');
        
        webLogger.info('AI', '🔄 Getting AI feedback on action results...');
        
        const previousAction = {
          action_type: aiResponse.action_type,
          success: actionSuccess,
          coordinates: aiResponse.coordinates,
          input_value: aiResponse.input_value,
          error_message: actionError,
          execution_time: actionExecutionTime,
          element_found: aiResponse.success
        };
        
        const appiumLogs = [{
          command: aiResponse.action_type,
          status: actionSuccess ? 'success' : 'failed',
          response_time: actionExecutionTime,
          error_details: actionError
        }];
        
        const feedbackResponse = await aiClient.processIterativeFeedback(
          testSession.instruction,
          afterScreenshotBase64,
          previousAction,
          appiumLogs,
          stepCount,
          { width: 1280, height: 720 }
        );
        
        if (feedbackResponse.progress_assessment) {
          webLogger.info('AI', `💭 AI Feedback: ${feedbackResponse.progress_assessment}`);
        }
        
        if (feedbackResponse.task_completed || !feedbackResponse.should_continue) {
          webLogger.success('AI', '🎉 AI determined test is complete!');
          break;
        }
        
        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (stepCount >= maxSteps) {
        webLogger.error('TEST', `⚠️ Reached maximum steps (${maxSteps}). Test stopped.`);
      }
      
      webLogger.info('TEST', `🏁 Iterative test completed after ${stepCount} steps`);
      
      return {
        success: true,
        steps: stepCount,
        mode: 'iterative',
        message: `Iterative test completed with ${stepCount} steps`
      };
      
    } catch (error) {
      webLogger.error('TEST', `❌ Iterative test failed: ${error.message}`);
      throw error;
    }
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BudsyWebServer();
  
  server.start().then(() => {
    console.log(`🌐 Budsy Web Interface running at http://localhost:${server.port}`);
  }).catch((error) => {
    console.error('Failed to start web server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

export default BudsyWebServer;