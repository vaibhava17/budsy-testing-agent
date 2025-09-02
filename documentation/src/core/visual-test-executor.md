# Visual Test Executor

**File:** `src/core/visual-test-executor.js`

## Overview
AI-guided test execution engine using screenshot analysis and coordinate-based actions. Provides advanced visual testing capabilities with iterative AI feedback and intelligent action planning.

## Import Dependencies
```javascript
import AppiumDriverManager from './appium-driver.js';  // WebDriver management
import aiClient from './ai-client.js';                 // AI backend communication
import logger from './logger.js';                      // Logging system
import config from '../config/index.js';               // Configuration settings
```

**Related Documentation:**
- [Appium Driver](./appium-driver.md) - Advanced coordinate-based WebDriver operations
- [AI Client](./ai-client.md) - AI backend communication and visual analysis
- [Logger](./logger.md) - Comprehensive logging system
- [Configuration](../config/index.md) - Configuration management

## Main Class

### VisualTestExecutor
Advanced AI-guided test executor that uses computer vision and coordinate-based actions for testing dynamic and visually-complex applications.

#### Constructor
- Initializes Appium driver manager
- Sets up AI client connection
- Configures test result storage
- Supports web logger for real-time updates

#### Properties
- **driver** - AppiumDriverManager instance
- **aiClient** - AI client for visual analysis
- **testResults** - Completed test results
- **currentTest** - Active test session
- **webLogger** - Optional WebSocket logger for web interface

## Core Execution Methods

### `initialize(options)`
Initializes visual test executor with platform-specific configuration.

**Parameters:**
- `options` - Initialization options:
  - `platform` - Target platform (`'web'`, `'android'`, `'ios'`)
  - `driver` - Platform-specific driver configuration

**Process:**
1. Validates AI backend health
2. Initializes appropriate driver
3. Passes WebSocket logger to AI client if available
4. Configures platform capabilities

### `executeVisualTest(instruction, url, options)`
Executes complete visual test using AI guidance.

**Parameters:**
- `instruction` - Natural language test instruction
- `url` - Target URL (for web tests)
- `options` - Execution configuration:
  - `expectedResult` - Expected outcome description
  - `context` - Additional test context

**Process:**
1. Navigates to URL and takes initial screenshot
2. Parses instruction into actionable steps
3. Executes each step with AI visual guidance
4. Performs final AI verification
5. Returns comprehensive test results

**Returns:**
```javascript
{
  success: boolean,
  testId: string,
  instruction: string,
  stepsExecuted: number,
  duration: number,
  screenshots: array,
  steps: array,
  verification: {
    success: boolean,
    result: string,
    confidence: number
  }
}
```

## Instruction Processing

### `_parseInstructionIntoActions(instruction)`
Converts natural language instructions into structured action steps.

**AI-Based Parsing:**
1. Uses AI backend for intelligent step generation
2. Provides context for visual-guided execution
3. Handles complex instruction breakdown

**Smart Parsing Fallback:**
When AI parsing fails, uses enhanced rule-based parsing:

#### Splitting Patterns
- `"and then"`, `"then"`, `"and"`, `","`
- `"after that"`, `"next"`, `"following that"`
- Period-delimited continuations
- Context-aware instruction segmentation

#### Action Detection
Advanced pattern matching for:
- **Navigation**: `"go to"`, `"navigate to"`, `"visit"`
- **Clicking**: `"click"`, `"press"`, `"tap"`, `"select"`
- **Typing**: `"type"`, `"enter"`, `"fill"`, `"input"`
- **Scrolling**: `"scroll"` with direction detection
- **Waiting**: `"wait"`, `"pause"` with duration extraction

### `_isExpectationStatement(statement)`
Filters expectation statements that don't require actions:
- `"should appear"`, `"will show"`, `"is visible"`
- `"expect"`, `"verify"`, `"confirm"`
- `"screen should"`, `"page should"`

## Visual Action Execution

### `_executeVisualActionStep(stepNumber, actionStep, screenshot, screenSize, options)`
Executes individual action steps using AI visual guidance with retry logic.

**Parameters:**
- `stepNumber` - Step sequence number
- `actionStep` - Action definition object
- `screenshot` - Current screen state
- `screenSize` - Screen dimensions
- `options` - Execution options

**Retry Strategy:**
- Maximum 3 attempts per action
- Screenshot refresh between attempts
- Alternative action exploration
- Scroll-based element discovery

**Process Per Attempt:**
1. **AI Analysis** - Get visual action guidance
2. **Coordinate Validation** - Verify action feasibility
3. **Action Execution** - Perform coordinate-based action
4. **Result Verification** - Confirm UI changes
5. **Error Recovery** - Handle failures gracefully

### Enhanced Context Building

#### `_detectFormContext(actionStep)`
Identifies form types for better AI guidance:
- **Login forms** - Email/password patterns
- **Registration forms** - Sign-up indicators
- **Search forms** - Search-related elements

#### `_detectPageContext(actionStep)`
Determines page context:
- **Login pages** - Authentication flows
- **Dashboard pages** - Main application areas
- **Profile pages** - User account sections

#### `_buildElementHints(actionStep)`
Provides element hints for AI analysis:
- Input field attributes and patterns
- Button identification markers
- Clickable element indicators

## Action Type Handling

### `_performActionAtCoordinates(actionStep, aiGuidance)`
Translates AI guidance into WebDriver actions.

**Supported Action Types:**

#### Click Actions
```javascript
await driver.clickAtCoordinates(x, y, boundingBox);
```

#### Double-Click Actions
```javascript
await driver.doubleClickAtCoordinates(x, y);
```

#### Type Actions
```javascript
// Enhanced email input detection
if (isEmailInput(actionStep.description, aiGuidance)) {
  await driver.typeEmailAtCoordinates(x, y, text, options);
} else {
  await driver.typeAtCoordinates(x, y, text);
}
```

#### Scroll Actions
```javascript
await driver.scroll(direction, amount);
```

#### Wait Actions
```javascript
await driver.driver.pause(waitTime);
```

### Email Input Detection

#### `_isEmailInput(description, aiGuidance)`
Advanced email field detection using:
- **Instruction Analysis** - Email-related keywords
- **Element Analysis** - AI-detected field properties
- **Attribute Matching** - Input type and attributes
- **Content Analysis** - Placeholder and label text

## Iterative Testing

### `executeIterativeTest(instruction, options)`
Advanced iterative testing with AI session management.

**Parameters:**
- `instruction` - Original user instruction
- `options` - Configuration:
  - `maxSteps` - Maximum execution steps (default: 10)
  - `timeout` - Session timeout (default: 5 minutes)

**Process:**
1. **Session Initialization** - Start AI session with initial screenshot
2. **Action Loop** - Execute AI-determined actions until completion
3. **Feedback Processing** - Get AI feedback after each action
4. **Completion Detection** - AI determines when task is finished
5. **Session Management** - Handle timeouts and step limits

**Session Flow:**
```
Initial Screenshot → AI Session Start → First Action
     ↓
Execute Action → Take Screenshot → Get AI Feedback
     ↓
Task Completed? → YES: Success
     ↓ NO
Next Action Available? → YES: Continue Loop
     ↓ NO/Timeout/MaxSteps
Stop with Status
```

**Return Status Types:**
- `'completed'` - Task successfully completed
- `'stopped'` - Stopped by AI recommendation
- `'max_steps_reached'` - Hit step limit
- `'error'` - Execution error occurred

### AI Feedback Processing
Uses `aiClient.processIterativeFeedback()` to analyze:
- **Progress Assessment** - Current task progress
- **Issue Detection** - Problems or blockers
- **Success Indicators** - Completion signals
- **Next Action** - Recommended next step

## Enhanced Action Recognition

### `_detectActionWithValue(instruction)`
Advanced action detection with value extraction:

#### Navigation Enhancement
- URL detection for direct navigation
- Link/button detection for click-based navigation
- Enhanced instruction transformation

#### Click Enhancement
- Common UI element patterns (sign in, submit, menu)
- Context-aware button identification
- Enhanced instruction clarification

#### Type Enhancement
- Email pattern extraction (`user@domain.com`)
- Field-specific value matching
- Input validation and formatting

## Visual Verification

### `_performFinalVisualVerification(instruction, screenshot, options)`
AI-powered final verification using screenshot analysis.

**Process:**
1. Takes final screenshot
2. Uses AI to verify instruction completion
3. Analyzes visual indicators of success
4. Returns confidence score and assessment

## UI Change Detection

### `_hasUIChanged(screenshot1, screenshot2)`
Basic UI change detection for action validation:
- Compares screenshot data lengths
- Uses threshold-based change detection
- Helps identify successful actions

## Test Session Management

### `getCurrentTestStatus()`
Returns current test execution status:
```javascript
{
  sessionId: string,
  status: 'running'|'completed'|'stopped'|'no_active_test',
  instruction: string,
  currentStep: number,
  startTime: string,
  endTime: string,
  screenshots: number
}
```

### `stopIterativeTest()`
Gracefully stops active iterative test execution.

## Error Handling and Recovery

### Action Execution Errors
- Multiple retry attempts with fresh screenshots
- Alternative action exploration
- Scroll-based element discovery
- Graceful degradation to fallback methods

### AI Communication Errors
- Network timeout handling
- Backend service unavailability
- Response validation and error recovery
- Comprehensive error logging

### Session Management Errors
- Session timeout handling
- Resource cleanup on failures
- State preservation for debugging

## Comparison with Traditional Test Executor

**Visual Test Executor Advantages:**
- **Dynamic UI Handling** - Adapts to changing layouts
- **No Selector Maintenance** - Uses visual recognition
- **Cross-Platform Consistency** - Same approach for web/mobile
- **Resilient to Changes** - Self-healing test capabilities

**Use Cases:**
- Applications with dynamic/changing UIs
- Cross-browser compatibility testing
- Mobile app testing without selectors
- Visual regression testing
- Legacy application testing

## Usage Examples

### Basic Visual Test
```javascript
const executor = new VisualTestExecutor();
await executor.initialize({ platform: 'web' });

const result = await executor.executeVisualTest(
  'Log in with email test@example.com and password 123456',
  'https://app.example.com/login'
);
```

### Iterative Testing
```javascript
const result = await executor.executeIterativeTest(
  'Complete the checkout process and place an order',
  {
    maxSteps: 15,
    timeout: 600000  // 10 minutes
  }
);
```

### Complex Multi-Step Test
```javascript
const result = await executor.executeVisualTest(
  'Navigate to products page, search for laptops, add the first item to cart, then proceed to checkout',
  'https://shop.example.com',
  {
    expectedResult: 'Checkout page with selected laptop in cart',
    context: { testType: 'e2e_shopping_flow' }
  }
);
```

## Related Files
- **Appium Driver:** `src/core/appium-driver.js` (see [Appium Driver Documentation](./appium-driver.md))
- **AI Client:** `src/core/ai-client.js` (see [AI Client Documentation](./ai-client.md))
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](./test-executor.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](./logger.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](../web/server.md))

## Performance Considerations
- Screenshot caching and optimization
- AI request batching and caching
- Intelligent retry strategies
- Efficient coordinate validation
- Optimized element detection algorithms

## Best Practices
- Write clear, specific instructions
- Use iterative mode for complex workflows
- Monitor AI confidence scores
- Implement proper error handling
- Use appropriate timeouts for different scenarios