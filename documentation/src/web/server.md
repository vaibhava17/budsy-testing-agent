# Budsy Web Interface Server

**File:** `src/web/server.js`

## Overview
Express server with WebSocket support providing real-time web interface for Budsy testing. Offers live test execution monitoring, interactive test management, and comprehensive logging visualization.

## Import Dependencies
```javascript
import express from 'express';                    // Web server framework
import { createServer } from 'http';              // HTTP server creation
import { Server as SocketServer } from 'socket.io'; // WebSocket server
import cors from 'cors';                          // Cross-origin resource sharing
import path from 'path';                          // Path utilities
import { fileURLToPath } from 'url';             // URL to file path conversion
import fs from 'fs/promises';                     // Asynchronous file operations
import archiver from 'archiver';                 // ZIP archive creation
import chokidar from 'chokidar';                 // File system watching
import { v4 as uuidv4 } from 'uuid';            // UUID generation

import TestExecutor from '../core/test-executor.js';        // Traditional test execution
import VisualTestExecutor from '../core/visual-test-executor.js'; // AI-guided execution
import config from '../config/index.js';                    // Configuration management
import logger from '../core/logger.js';                     // Logging system
import aiClient from '../core/ai-client.js';               // AI backend client
```

**Related Documentation:**
- [Test Executor](../core/test-executor.md) - Traditional selector-based testing
- [Visual Test Executor](../core/visual-test-executor.md) - AI-guided visual testing
- [Configuration](../config/index.md) - Configuration management
- [Logger](../core/logger.md) - Logging system
- [AI Client](../core/ai-client.md) - AI backend communication

## Main Class

### BudsyWebServer
Comprehensive web server providing real-time test execution interface with WebSocket communication.

#### Constructor
- Creates Express app and HTTP server
- Initializes Socket.IO server with CORS configuration
- Sets up port configuration from environment
- Initializes active test and log watcher storage
- Configures middleware, routes, and WebSocket handlers

#### Properties
- **app** - Express application instance
- **server** - HTTP server instance
- **io** - Socket.IO server instance
- **port** - Server port (default: 3000)
- **activeTests** - Map of running test sessions
- **logWatchers** - Map of file system watchers

## Server Setup

### Middleware Configuration
```javascript
app.use(cors());                                    // Enable CORS
app.use(express.json({ limit: '50mb' }));          // JSON parser with large payload support
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // URL encoded parser
app.use(express.static(path.join(__dirname, 'static')));        // Static file serving
```

### Static File Serving
Serves web interface files from `src/web/static/` directory.

## REST API Endpoints

### Health Check
**GET** `/api/health`

Returns service health status including:
- Web server status
- AI backend connectivity
- Appium server availability
- Current timestamp

**Response:**
```javascript
{
  status: 'healthy'|'unhealthy',
  services: {
    web: boolean,
    ai_backend: boolean,
    appium: boolean
  },
  timestamp: string
}
```

### Configuration
**GET** `/api/config`

Returns current configuration (sanitized):
```javascript
{
  backend: { url: string, hasAuthKey: boolean },
  appium: { serverUrl: string },
  screenshots: { dir: string, save: boolean },
  testing: { defaultTimeout: number, stepDelay: number }
}
```

### Test Management

#### Start Test
**POST** `/api/tests/start`

Initiates new test execution.

**Request Body:**
```javascript
{
  instruction: string,        // Required: Test instruction
  url: string,               // Optional: Target URL for web tests
  platform: string,          // Optional: 'web'|'android'|'ios' (default: 'web')
  expectedResult: string,     // Optional: Expected outcome
  options: object,           // Optional: Additional options
  testMode: string           // Optional: 'visual'|'traditional'|'iterative' (default: 'visual')
}
```

**Response:**
```javascript
{
  testId: string,
  status: 'started',
  message: string,
  testMode: string
}
```

#### Get Test Status
**GET** `/api/tests/:testId`

Returns current test execution status.

**Response:**
```javascript
{
  id: string,
  status: string,
  instruction: string,
  platform: string,
  startTime: string,
  endTime: string,
  duration: number,
  result: object,
  error: string,
  logs: array                // Last 50 log entries
}
```

#### Stop Test
**POST** `/api/tests/:testId/stop`

Stops active test execution and cleans up resources.

#### Download Logs
**GET** `/api/tests/:testId/logs/download`

Creates and downloads ZIP archive containing:
- Test session data (JSON)
- Test execution logs
- Screenshots (if available)
- Main application log file

#### List Active Tests
**GET** `/api/tests`

Returns list of all active test sessions.

## WebSocket Communication

### Connection Handling
```javascript
io.on('connection', (socket) => {
  // Client connected
  
  socket.on('join_test', (testId) => {
    socket.join(testId);  // Join test-specific room
  });
  
  socket.on('leave_test', (testId) => {
    socket.leave(testId); // Leave test room
  });
});
```

### Real-Time Events

#### Test Status Updates
- `test_status` - Test status changes
- `test_completed` - Test completion with results
- `test_failed` - Test failure with error details
- `test_stopped` - Test stopped by user

#### Live Logging
- `log` - Real-time log entries with formatting
- `failure_logs_ready` - Log archive ready for download

## Test Execution Engine

### `executeTest(testId, testSession)`
Core test execution orchestrator supporting multiple test modes.

**Test Modes:**

#### Visual Mode (Default)
Uses VisualTestExecutor for AI-guided visual testing:
```javascript
result = await executor.executeVisualTest(
  testSession.instruction,
  testSession.url,
  options
);
```

#### Traditional Mode
Uses TestExecutor for selector-based testing:
```javascript
result = await executor.executeWithVerification(
  testSession.instruction,
  testSession.url,
  options
);
```

#### Iterative Mode
Uses advanced iterative testing workflow:
```javascript
result = await this.executeIterativeTest(
  executor,
  testSession,
  webLogger
);
```

### Executor Configuration
```javascript
await executor.initialize({
  platform: testSession.platform,
  driver: {
    capabilities: testSession.platform === 'web' ? {
      browserName: 'chrome'
    } : testSession.options.capabilities || {}
  }
});
```

## Advanced Logging System

### `createWebLogger(testId)`
Creates WebSocket-enabled logger for real-time test monitoring.

**Features:**
- Real-time log streaming via WebSocket
- Local log storage in test session
- Integration with file-based logger
- Specialized logging methods for different components

**Logging Methods:**
- `info()`, `error()`, `success()`, `debug()`, `warn()`
- `testStart()`, `testEnd()` - Test lifecycle
- `stepStart()`, `stepEnd()` - Step execution
- `aiRequest()`, `aiResponse()` - AI interaction
- Automatic log entry structure with timestamps

**Log Entry Structure:**
```javascript
{
  timestamp: string,
  level: 'info'|'error'|'success'|'debug'|'warn',
  component: string,
  message: string,
  data: object
}
```

## Iterative Testing Implementation

### `executeIterativeTest(executor, testSession, webLogger)`
Advanced iterative testing with AI feedback loops.

**Process:**
1. **Initialize Navigation** - Navigate to target URL
2. **Action Loop** (max 10 steps):
   - Take screenshot
   - Get AI action guidance
   - Execute action via Appium
   - Capture execution results
   - Get AI feedback on progress
   - Determine continuation or completion
3. **Completion Handling** - Process final results

**AI Integration:**
- Screenshot-based action generation
- Real-time progress assessment
- Automatic completion detection
- Error recovery and retry logic

**Features:**
- Maximum step limiting (prevents infinite loops)
- Progress tracking and logging
- AI-determined completion criteria
- Comprehensive error handling

## File Management

### Log Archive Creation
- ZIP file generation for test sessions
- Screenshot inclusion when available
- Main log file integration
- Test session metadata preservation

### Static File Serving
- Web interface HTML/CSS/JS files
- Screenshot serving for visualization
- Log file access for debugging

## Error Handling

### Test Execution Errors
- Comprehensive error capturing
- Automatic cleanup on failures
- Error logging with context
- Client notification via WebSocket

### Server Errors
- Graceful error responses
- Resource cleanup on failures
- Connection error handling
- Process signal handling

## Resource Management

### Test Session Lifecycle
```javascript
{
  id: string,
  instruction: string,
  url: string,
  platform: string,
  expectedResult: string,
  options: object,
  testMode: string,
  status: 'starting'|'initializing'|'running'|'completed'|'failed'|'stopped',
  startTime: Date,
  endTime: Date,
  duration: number,
  logs: array,
  screenshots: array,
  executor: object
}
```

### Cleanup Operations
- WebDriver session termination
- File watcher cleanup
- Memory management
- Resource deallocation

## Server Lifecycle

### `start()`
Starts web server and returns promise:
```javascript
await server.start();
console.log(`Server running at http://localhost:${port}`);
```

### `stop()`
Graceful shutdown with:
- Active test cleanup
- File watcher termination
- Server connection closing
- Resource cleanup

## Usage Examples

### Starting Web Interface
```javascript
const server = new BudsyWebServer();
await server.start();
```

### Via CLI
```bash
# Default configuration
budsy web

# Custom port and host
budsy web --port 8080 --host 0.0.0.0
```

### Client Integration
```javascript
// Connect to server
const socket = io('http://localhost:3000');

// Join test room
socket.emit('join_test', testId);

// Listen for logs
socket.on('log', (logEntry) => {
  console.log(`[${logEntry.level}] ${logEntry.message}`);
});

// Listen for completion
socket.on('test_completed', (result) => {
  console.log('Test completed:', result);
});
```

## Configuration Integration

### Environment Variables
- `WEB_PORT` - Server port configuration
- `WEB_HOST` - Server host binding
- Integration with main config system

### Path Configuration
- Static file serving paths
- Screenshot directory access
- Log file locations
- Archive storage paths

## Security Considerations
- CORS configuration for cross-origin access
- Request size limits for large screenshots
- File system access restrictions
- Secure archive handling

## Related Files
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](../core/test-executor.md))
- **Visual Test Executor:** `src/core/visual-test-executor.js` (see [Visual Test Executor Documentation](../core/visual-test-executor.md))
- **AI Client:** `src/core/ai-client.js` (see [AI Client Documentation](../core/ai-client.md))
- **Main CLI:** `src/index.js` (see [CLI Documentation](../index.md))
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](../config/index.md))

## Performance Features
- Asynchronous test execution
- WebSocket-based real-time updates
- Efficient log streaming
- Background test processing
- Resource-conscious memory management