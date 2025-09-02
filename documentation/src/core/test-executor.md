# Test Executor

**File:** `src/core/test-executor.js`

## Overview
Main execution engine that combines Appium driver with AI verification for traditional selector-based testing. Coordinates between AI-generated test steps and WebDriver execution.

## Import Dependencies
```javascript
import AppiumDriverManager from './appium-driver.js';  // WebDriver management
import aiClient from './ai-client.js';                 // AI backend communication
import logger from './logger.js';                      // Logging system
import config from '../config/index.js';               // Configuration settings
```

**Related Documentation:**
- [Appium Driver](./appium-driver.md) - WebDriver management
- [AI Client](./ai-client.md) - AI backend communication
- [Logger](./logger.md) - Logging system
- [Configuration](../config/index.md) - Configuration settings

## Main Class

### TestExecutor
Orchestrates traditional selector-based test execution with AI verification and step generation.

#### Constructor
- Initializes Appium driver manager
- Sets up AI client connection
- Prepares test result storage
- Configures current test tracking

#### Properties
- **driver** - AppiumDriverManager instance
- **aiClient** - AI client for backend communication
- **testResults** - Array of completed test results
- **currentTest** - Current test session data

## Core Methods

### `initialize(options)`
Initializes the test executor with platform-specific configuration.

**Parameters:**
- `options` - Initialization configuration:
  - `platform` - Target platform (`'web'`, `'android'`, `'ios'`)
  - `driver` - Driver-specific options

**Process:**
1. Validates AI backend health
2. Initializes appropriate driver (web or mobile)
3. Configures platform-specific capabilities

### `executeInstruction(instruction, options)`
Executes test from human-readable instruction.

**Parameters:**
- `instruction` - Natural language test description
- `options` - Execution options:
  - `context` - Additional context data
  - `screenshotBeforeStep` - Enable step screenshots

**Process:**
1. Generates test steps from instruction using AI
2. Executes each step sequentially
3. Performs final verification if requested
4. Records results and timing

**Returns:**
```javascript
{
  success: boolean,
  testId: string,
  instruction: string,
  stepsExecuted: number,
  duration: number,
  screenshots: array,
  steps: array
}
```

### `executeWithVerification(instruction, url, options)`
Executes test with comprehensive AI-powered verification.

**Parameters:**
- `instruction` - Test instruction
- `url` - Target URL for web tests
- `options` - Execution options:
  - `expectedResult` - Expected outcome description
  - `finalVerification` - Enable final verification
  - `context` - Additional context

**Process:**
1. Navigates to URL if provided
2. Executes test instruction
3. Takes final screenshot
4. Performs AI verification of results
5. Combines execution and verification results

**Returns:**
```javascript
{
  ...executionResult,
  verification: {
    success: boolean,
    result: string,
    confidence: number,
    details: object
  },
  finalScreenshot: string
}
```

## Step Execution

### `_executeStep(stepNumber, step, options)`
Executes individual test steps with comprehensive logging.

**Parameters:**
- `stepNumber` - Sequential step identifier
- `step` - Step definition object:
  - `action` - Action type ('navigate', 'click', 'type', 'wait', 'verify')
  - `locator` - Element selector
  - `value` - Input value for type actions
  - `description` - Human-readable description

**Step Types:**

#### Navigate Steps
```javascript
{
  action: 'navigate',
  value: 'https://example.com',
  description: 'Navigate to login page'
}
```

#### Click Steps  
```javascript
{
  action: 'click',
  locator: '#submit-button',
  description: 'Click submit button'
}
```

#### Type Steps
```javascript
{
  action: 'type',
  locator: '#email-input',
  value: 'user@example.com',
  description: 'Enter email address'
}
```

#### Wait Steps
```javascript
{
  action: 'wait',
  locator: '#loading-spinner',    // Optional: wait for element
  value: '2000',                  // Optional: wait duration in ms
  description: 'Wait for page load'
}
```

#### Verify Steps
```javascript
{
  action: 'verify',
  expected: 'Login successful message appears',
  locator: '#success-message',
  description: 'Verify successful login'
}
```

## Verification Methods

### `_verifyStep(step, stepNumber, options)`
Performs AI-powered verification of individual steps.

**Process:**
1. Takes screenshot for verification
2. Prepares verification instruction
3. Calls AI verification service
4. Validates verification results
5. Throws error if verification fails

### `_performFinalVerification(instruction, options)`
Conducts final AI verification of complete test execution.

**Process:**
1. Takes final screenshot
2. Verifies instruction completion
3. Validates against expected results
4. Records verification confidence

## Test Result Management

### `getTestSummary()`
Provides comprehensive test execution summary.

**Returns:**
```javascript
{
  totalTests: number,
  passedTests: number,
  failedTests: number,
  successRate: number,  // Percentage
  tests: [
    {
      id: string,
      instruction: string,
      success: boolean,
      duration: number,
      stepsExecuted: number,
      error: string
    }
  ]
}
```

## Error Handling

### Step Execution Errors
- Individual step failures are caught and logged
- Step results include error details
- Failed steps stop execution by default

### Test Execution Errors
- Comprehensive error logging with context
- Test duration recorded even on failure
- Error details preserved in test results

### Verification Errors
- AI verification failures are handled gracefully
- Verification errors include confidence scores
- Detailed error reporting for debugging

## Configuration Integration

### Timeout Settings
- Uses `config.testing.defaultTimeout` for operations
- `config.testing.waitForElementTimeout` for element waits
- `config.testing.stepDelay` for inter-step delays

### Screenshot Settings
- Integrates with `config.screenshots` for capture settings
- Automatic screenshot naming and storage
- Configurable screenshot capture frequency

## Usage Examples

### Basic Test Execution
```javascript
const executor = new TestExecutor();

await executor.initialize({ platform: 'web' });

const result = await executor.executeInstruction(
  'Log into the website with valid credentials',
  { context: { environment: 'staging' } }
);
```

### Web Test with Verification
```javascript
const result = await executor.executeWithVerification(
  'Complete the user registration form',
  'https://example.com/register',
  {
    expectedResult: 'Registration success page displayed',
    screenshotBeforeStep: true
  }
);
```

### Test Summary Analysis
```javascript
// After running multiple tests
const summary = executor.getTestSummary();
console.log(`Success rate: ${summary.successRate}%`);
console.log(`Total tests: ${summary.totalTests}`);
```

## Test Session Management

### Current Test Tracking
Each test execution creates a current test object:
```javascript
{
  id: string,
  instruction: string,
  startTime: number,
  steps: array,
  screenshots: array,
  result: object
}
```

### Step Result Structure
```javascript
{
  stepNumber: number,
  action: string,
  description: string,
  success: boolean,
  duration: number,
  beforeScreenshot: string,
  afterScreenshot: string,
  error: string
}
```

## Cleanup and Resources

### `cleanup()`
Properly closes driver sessions and cleans up resources.

**Process:**
1. Calls driver quit method
2. Closes WebDriver session
3. Logs cleanup completion
4. Handles cleanup errors gracefully

## Comparison with Visual Test Executor

**TestExecutor (Traditional):**
- Uses CSS selectors and XPath
- Relies on DOM element identification
- Suitable for stable, well-structured applications
- Faster execution with direct element access

**VisualTestExecutor (AI-Guided):**
- Uses coordinate-based actions from AI vision
- Analyzes screenshots for element detection
- Handles dynamic UIs and visual changes
- More resilient to layout changes

## Related Files
- **Appium Driver:** `src/core/appium-driver.js` (see [Appium Driver Documentation](./appium-driver.md))
- **AI Client:** `src/core/ai-client.js` (see [AI Client Documentation](./ai-client.md))
- **Visual Test Executor:** `src/core/visual-test-executor.js` (see [Visual Test Executor Documentation](./visual-test-executor.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](./logger.md))
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](../config/index.md))
- **Main CLI:** `src/index.js` (see [CLI Documentation](../index.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](../web/server.md))

## Best Practices

### Test Instruction Writing
- Use clear, specific instructions
- Include expected outcomes
- Specify context when needed
- Break complex flows into steps

### Error Recovery
- Always call cleanup() in finally blocks
- Check test summaries for failure patterns
- Use verification for critical test points
- Monitor step execution timing