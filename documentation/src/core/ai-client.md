# AI Client

**File:** `src/core/ai-client.js`

## Overview
Handles communication with the backend LLM service for UI verification, test step generation, and visual action guidance. Provides a comprehensive interface for AI-powered testing capabilities.

## Import Dependencies
```javascript
import axios from 'axios';                      // HTTP client library
import config from '../config/index.js';       // Configuration management
import logger from './logger.js';              // Logging system
```

**Related Documentation:**
- [Configuration](../config/index.md) - Application configuration
- [Logger](./logger.md) - Logging system
- axios: External HTTP client library

## Main Class

### AIClient
Singleton class managing AI backend communication with comprehensive error handling and logging.

#### Constructor
- Initializes base URL and authentication from config
- Sets up axios client with default headers
- Configures request/response interceptors
- Supports custom web logger for web interface

#### Properties
- **baseURL** - Backend service URL
- **authKey** - API authentication key  
- **webLogger** - Optional WebSocket logger for web interface
- **client** - Configured axios instance

## Core Methods

### `verifyScreenshot(screenshotBase64, instruction, options)`
Performs AI-powered UI verification against screenshots.

**Parameters:**
- `screenshotBase64` - Base64 encoded screenshot
- `instruction` - Human instruction for verification
- `options` - Additional verification options:
  - `expectedResult` - Expected outcome description
  - `page` - Current page context
  - `step` - Current step number
  - `context` - Additional context data

**Returns:**
```javascript
{
  success: boolean,
  result: string,
  confidence: number,
  details: object,
  errors: array
}
```

**Usage Example:**
```javascript
const result = await aiClient.verifyScreenshot(
  screenshot,
  "Verify the login form is displayed",
  { expectedResult: "Login form with email and password fields" }
);
```

### `generateTestSteps(instruction, context)`
Converts human instructions into structured test steps.

**Parameters:**
- `instruction` - Natural language test instruction
- `context` - Test context information

**Returns:**
```javascript
{
  steps: array,     // Generated test steps
  summary: string   // Test summary
}
```

### `getVisualActionGuidance(screenshotBase64, instruction, screenSize, options)`
Provides AI-guided coordinate-based actions from screenshot analysis.

**Parameters:**
- `screenshotBase64` - Current screen state
- `instruction` - Action instruction (e.g., "click sign in button")
- `screenSize` - Screen dimensions `{width, height}`
- `options` - Additional options:
  - `confidenceThreshold` - Minimum confidence (default: 0.8)

**Returns:**
```javascript
{
  success: boolean,
  action_type: string,        // 'click', 'type', 'scroll', etc.
  actionType: string,         // Backward compatibility
  coordinates: {x, y},
  element_info: {
    element_type: string,
    description: string,
    bounding_box: {left, top, right, bottom},
    is_visible: boolean,
    is_clickable: boolean,
    text_content: string
  },
  confidence: number,
  reasoning: string,
  alternative_actions: array,
  input_value: string,        // For type actions
  scroll_direction: string,   // For scroll actions
  wait_condition: string,     // For wait actions
  error: string,
  // Enhanced debugging features
  coordinateValidation: {
    isValid: boolean,
    reason: string,
    safeZone: object
  },
  fallbackCoordinates: array, // Alternative coordinates for retry
  usingFallback: boolean,     // Whether fallback coordinates were used
  requestDuration: string,    // Request processing time
  rawResponse: object         // Complete backend response
}
```

### `startIterativeSession(instruction, screenshotBase64, screenSize, sessionConfig)`
Initializes an iterative test session with the AI backend.

**Parameters:**
- `instruction` - Original user instruction
- `screenshotBase64` - Initial screenshot
- `screenSize` - Screen dimensions
- `sessionConfig` - Session configuration:
  - `timeout` - Session timeout (default: 300)
  - `max_steps` - Maximum steps
  - `session_id` - Unique session identifier

**Returns:**
```javascript
{
  session_id: string,
  first_action: object,
  estimated_total_steps: number,
  session_expires_at: string
}
```

### `processIterativeFeedback(originalInstruction, currentScreenshot, previousAction, appiumLogs, stepNumber, screenSize, sessionContext)`
Processes iterative feedback and determines next actions.

**Parameters:**
- `originalInstruction` - Original task instruction
- `currentScreenshot` - Current screen state
- `previousAction` - Previous action details
- `appiumLogs` - Appium execution logs
- `stepNumber` - Current step number
- `screenSize` - Screen dimensions
- `sessionContext` - Session context data

**Returns:**
```javascript
{
  should_continue: boolean,
  task_completed: boolean,
  next_action: object,
  progress_assessment: string,
  issues_found: array,
  success_indicators: array,
  confidence: number,
  reasoning: string,
  estimated_steps_remaining: number
}
```

## Utility Methods

### `healthCheck()`
Verifies AI backend availability and health.

**Returns:** `boolean` - Service health status

### `getServiceInfo()`
Retrieves AI service information and capabilities.

## Request/Response Handling

### Request Interceptor
- Logs all outgoing requests with method and URL
- Uses appropriate logger (webLogger or default)

### Response Interceptor  
- Logs successful responses with status codes
- Handles and logs error responses with detailed information
- Provides structured error data for debugging

## Error Handling & Validation
- **Comprehensive error catching** with detailed logging and context
- **Coordinate validation** against screen bounds and safety zones
- **Fallback coordinate generation** for retry scenarios  
- **Enhanced debugging** with request/response timing and validation
- **Automatic retry logic** with progressive confidence thresholds
- **Timeout handling** for long-running operations
- **LLM backend integration** with enhanced context and error reporting

## Logging Integration
- Detailed request/response logging
- Performance metrics (request duration)
- AI response analysis logging
- Custom log methods:
  - `aiRequest()` - Log AI requests
  - `aiResponse()` - Log AI responses

## Backend Endpoints
All endpoints are configurable via `config.backend.endpoints`:

- **UI Verification:** `/llm/ui-verification/verify`
- **Step Generation:** `/llm/ui-verification/generate-steps`
- **Visual Actions:** `/llm/ui-verification/visual-action`
- **Session Start:** `/llm/ui-verification/start-session`
- **Iterative Feedback:** `/llm/ui-verification/iterative-feedback`
- **Health Check:** `/llm/ui-verification/health`

## LLM Backend Integration Improvements

### Enhanced Request Context
- **Attempt-specific data** for progressive retry logic
- **Viewport information** for accurate coordinate calculation
- **Previous failure analysis** for learning from errors
- **Enhanced email detection** with specialized context
- **Confidence threshold adaptation** based on retry attempts

### Coordinate Validation & Fallbacks
- **Safety zone validation** (15px margins, 60px top for browser toolbar)
- **Automatic coordinate adjustment** with confidence reduction
- **Fallback coordinate generation** using bounding box and common patterns
- **Progressive targeting strategies** (center, offset, common positions)

### Debugging Enhancements
- **Comprehensive error logging** with backend response analysis
- **Request/response timing** and payload size monitoring
- **Coordinate validation reporting** with specific failure reasons
- **Alternative action analysis** when primary actions fail

## Usage Patterns

### Basic Verification
```javascript
const verification = await aiClient.verifyScreenshot(
  screenshot, 
  "Check if user is logged in"
);
```

### Visual Action Guidance
```javascript
const action = await aiClient.getVisualActionGuidance(
  screenshot,
  "click the submit button",
  {width: 1280, height: 720}
);
```

### Iterative Testing
```javascript
// Start session
const session = await aiClient.startIterativeSession(
  instruction, 
  initialScreenshot, 
  screenSize
);

// Process feedback
const feedback = await aiClient.processIterativeFeedback(
  instruction,
  currentScreenshot,
  previousAction,
  logs,
  stepNumber,
  screenSize,
  context
);
```

## Related Files
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](../config/index.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](./logger.md))
- **Visual Test Executor:** `src/core/visual-test-executor.js` (see [Visual Test Executor Documentation](./visual-test-executor.md))
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](./test-executor.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](../web/server.md))

## Singleton Export
Exported as both named export and default for flexible importing:
```javascript
import { aiClient } from './ai-client.js';
import aiClient from './ai-client.js';  // Both work
```