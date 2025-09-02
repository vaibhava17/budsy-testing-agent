#!/usr/bin/env node

/**
 * Budsy Testing Agent - Main CLI
 * AI-powered UI testing agent using Appium with screenshot verification
 */

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import TestExecutor from './core/test-executor.js';
import BudsyWebServer from './web/server.js';
import logger from './core/logger.js';
import config from './config/index.js';

// ASCII Art for Budsy
const BUDSY_LOGO = `
██████╗ ██╗   ██╗██████╗ ███████╗██╗   ██╗
██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗ ██╔╝
██████╔╝██║   ██║██║  ██║███████╗ ╚████╔╝ 
██╔══██╗██║   ██║██║  ██║╚════██║  ╚██╔╝  
██████╔╝╚██████╔╝██████╔╝███████║   ██║   
╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   

🤖 AI-Powered UI Testing Agent
`;

class BudsyCLI {
  constructor() {
    this.executor = new TestExecutor();
  }

  /**
   * Interactive mode - prompt user for test details
   */
  async interactiveMode() {
    console.log(chalk.cyan(BUDSY_LOGO));
    console.log(chalk.yellow("Welcome to Budsy! Let's set up your test."));

    try {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: 'Which platform are you testing?',
          choices: [
            { name: 'Web Browser', value: 'web' },
            { name: 'Android App', value: 'android' },
            { name: 'iOS App', value: 'ios' }
          ]
        },
        {
          type: 'input',
          name: 'url',
          message: 'Enter the website URL:',
          when: (answers) => answers.platform === 'web',
          validate: (input) => {
            if (!input.trim()) return 'URL is required for web testing';
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        },
        {
          type: 'input',
          name: 'appPath',
          message: 'Enter the app path or package name:',
          when: (answers) => answers.platform !== 'web',
          validate: (input) => input.trim() ? true : 'App path is required for mobile testing'
        },
        {
          type: 'editor',
          name: 'instruction',
          message: 'Enter your test instruction (natural language):',
          validate: (input) => input.trim() ? true : 'Test instruction is required'
        },
        {
          type: 'input',
          name: 'expectedResult',
          message: 'What should the final result look like? (optional):'
        },
        {
          type: 'confirm',
          name: 'saveScreenshots',
          message: 'Save screenshots during test execution?',
          default: true
        }
      ]);

      await this._executeTest(answers);

    } catch (error) {
      if (error.isTtyError) {
        console.error(chalk.red('Interactive mode not supported in this environment'));
        console.log(chalk.yellow('Use command line arguments instead. Run with --help for usage.'));
      } else {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  }

  /**
   * Execute test with given parameters
   */
  async _executeTest(params) {
    const startTime = Date.now();

    try {
      // Display test summary
      console.log(chalk.blue('\n📋 Test Summary:'));
      console.log(`Platform: ${chalk.cyan(params.platform)}`);
      if (params.url) console.log(`URL: ${chalk.cyan(params.url)}`);
      if (params.appPath) console.log(`App: ${chalk.cyan(params.appPath)}`);
      console.log(`Instruction: ${chalk.yellow(params.instruction.substring(0, 100) + '...')}`);
      if (params.expectedResult) console.log(`Expected: ${chalk.green(params.expectedResult)}`);
      console.log('');

      // Initialize test executor
      console.log(chalk.blue('🚀 Initializing test executor...'));
      const driverOptions = {
        platform: params.platform,
        driver: {
          capabilities: params.appPath ? { 
            'appium:app': params.appPath,
            'appium:packageName': params.appPath 
          } : {}
        }
      };

      await this.executor.initialize(driverOptions);

      // Execute test
      console.log(chalk.blue('⚡ Executing test with AI verification...'));
      const result = await this.executor.executeWithVerification(
        params.instruction,
        params.url,
        {
          expectedResult: params.expectedResult,
          screenshotBeforeStep: params.saveScreenshots,
          context: {
            platform: params.platform,
            testMode: 'interactive'
          }
        }
      );

      // Display results
      const duration = Date.now() - startTime;
      this._displayResults(result, duration);

    } catch (error) {
      console.error(chalk.red(`\n❌ Test failed: ${error.message}\n`));
      
      // Show test summary even on failure
      const summary = this.executor.getTestSummary();
      if (summary.totalTests > 0) {
        this._displayTestSummary(summary);
      }
      
      process.exit(1);
    } finally {
      await this.executor.cleanup();
    }
  }

  /**
   * Display test results
   */
  _displayResults(result, totalDuration) {
    console.log(chalk.green('\n✅ Test completed successfully!\n'));

    // Execution Results
    console.log(chalk.blue('📊 Execution Results:'));
    console.log(`Steps executed: ${chalk.cyan(result.stepsExecuted)}`);
    console.log(`Duration: ${chalk.cyan(result.duration)}ms`);
    console.log(`Screenshots taken: ${chalk.cyan(result.screenshots?.length || 0)}`);

    // AI Verification Results
    if (result.verification) {
      console.log(chalk.blue('\n🤖 AI Verification Results:'));
      console.log(`Status: ${result.verification.success ? chalk.green('PASSED') : chalk.red('FAILED')}`);
      if (result.verification.confidence) {
        console.log(`Confidence: ${chalk.cyan((result.verification.confidence * 100).toFixed(1) + '%')}`);
      }
      console.log(`Analysis: ${chalk.yellow(result.verification.result.substring(0, 200) + '...')}`);
    }

    // File Locations
    console.log(chalk.blue('\n📁 Generated Files:'));
    console.log(`Screenshots: ${chalk.cyan(config.screenshots.dir)}`);
    console.log(`Logs: ${chalk.cyan(config.logging.file)}`);

    console.log(chalk.green(`\n🎉 Total test time: ${totalDuration}ms\n`));
  }

  /**
   * Display test summary
   */
  _displayTestSummary(summary) {
    console.log(chalk.blue('\n📈 Test Summary:'));
    console.log(`Total tests: ${chalk.cyan(summary.totalTests)}`);
    console.log(`Passed: ${chalk.green(summary.passedTests)}`);
    console.log(`Failed: ${chalk.red(summary.failedTests)}`);
    console.log(`Success rate: ${chalk.yellow(summary.successRate.toFixed(1) + '%')}`);
  }
}

// CLI Setup
const cli = new BudsyCLI();

program
  .name('budsy')
  .description('AI-powered UI testing agent using Appium with screenshot verification')
  .version('1.0.0');

program
  .command('test')
  .description('Run test in interactive mode')
  .action(async () => {
    await cli.interactiveMode();
  });

program
  .command('run')
  .description('Run test with command line arguments')
  .option('-p, --platform <platform>', 'Platform: web, android, ios', 'web')
  .option('-u, --url <url>', 'URL for web testing')
  .option('-a, --app <path>', 'App path for mobile testing')
  .option('-i, --instruction <text>', 'Test instruction')
  .option('-e, --expected <text>', 'Expected result description')
  .option('--no-screenshots', 'Disable screenshot saving')
  .action(async (options) => {
    if (!options.instruction) {
      console.error(chalk.red('Error: Test instruction is required'));
      console.log(chalk.yellow('Use --instruction "your test instruction here"'));
      process.exit(1);
    }

    if (options.platform === 'web' && !options.url) {
      console.error(chalk.red('Error: URL is required for web testing'));
      console.log(chalk.yellow('Use --url "https://example.com"'));
      process.exit(1);
    }

    if (options.platform !== 'web' && !options.app) {
      console.error(chalk.red('Error: App path is required for mobile testing'));
      console.log(chalk.yellow('Use --app "/path/to/app.apk" or --app "com.example.app"'));
      process.exit(1);
    }

    await cli._executeTest({
      platform: options.platform,
      url: options.url,
      appPath: options.app,
      instruction: options.instruction,
      expectedResult: options.expected,
      saveScreenshots: options.screenshots
    });
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log(chalk.cyan(BUDSY_LOGO));
    console.log(chalk.blue('📋 Current Configuration:\n'));
    
    console.log(chalk.yellow('Backend:'));
    console.log(`  URL: ${config.backend.url}`);
    console.log(`  Auth Key: ${config.backend.authKey ? '***configured***' : 'not set'}`);
    
    console.log(chalk.yellow('\nAppium:'));
    console.log(`  Server URL: ${config.appium.serverUrl}`);
    console.log(`  Log Level: ${config.appium.logLevel}`);
    
    console.log(chalk.yellow('\nScreenshots:'));
    console.log(`  Directory: ${config.screenshots.dir}`);
    console.log(`  Save: ${config.screenshots.save}`);
    
    console.log(chalk.yellow('\nTesting:'));
    console.log(`  Default Timeout: ${config.testing.defaultTimeout}ms`);
    console.log(`  Step Delay: ${config.testing.stepDelay}ms`);
    
    console.log(chalk.green('\n✨ Configuration loaded from .env file'));
  });

program
  .command('web')
  .description('Start web interface for Budsy')
  .option('-p, --port <port>', 'Web server port', '3000')
  .option('--host <host>', 'Web server host', 'localhost')
  .action(async (options) => {
    console.log(chalk.cyan(BUDSY_LOGO));
    console.log(chalk.blue('🌐 Starting Budsy Web Interface...\n'));
    
    // Set port from command line
    process.env.WEB_PORT = options.port;
    process.env.WEB_HOST = options.host;
    
    const webServer = new BudsyWebServer();
    
    try {
      await webServer.start();
      console.log(chalk.green(`✅ Budsy Web Interface started successfully!`));
      console.log(chalk.yellow(`🔗 Access your testing interface at: http://${options.host}:${options.port}`));
      console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
      
      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 Shutting down web interface...'));
        await webServer.stop();
        console.log(chalk.green('✅ Web interface stopped gracefully'));
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n🛑 Shutting down web interface...'));
        await webServer.stop();
        console.log(chalk.green('✅ Web interface stopped gracefully'));
        process.exit(0);
      });
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to start web interface: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Check health of all services')
  .action(async () => {
    console.log(chalk.cyan(BUDSY_LOGO));
    console.log(chalk.blue('🏥 Health Check:\n'));
    
    const executor = new TestExecutor();
    
    // Check AI backend
    console.log(chalk.yellow('Checking AI backend...'));
    try {
      const aiHealthy = await executor.aiClient.healthCheck();
      console.log(`AI Backend: ${aiHealthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy')}`);
    } catch (error) {
      console.log(`AI Backend: ${chalk.red('✗ Error - ' + error.message)}`);
    }
    
    // Check Appium server (basic connectivity)
    console.log(chalk.yellow('Checking Appium server...'));
    try {
      // This is a simple check - actual driver init would be more thorough
      const appiumUrl = new URL(config.appium.serverUrl);
      console.log(`Appium Server: ${chalk.green('✓ URL configured')} (${appiumUrl.href})`);
    } catch (error) {
      console.log(`Appium Server: ${chalk.red('✗ Invalid URL - ' + error.message)}`);
    }
    
    console.log(chalk.green('\n🎉 Health check completed!'));
  });

// Default command - run interactive mode if no arguments
if (process.argv.length <= 2) {
  try {
    program.parse([process.argv[0], process.argv[1] || 'budsy', 'test']);
  } catch (error) {
    // Fallback to direct execution
    cli.interactiveMode().catch(err => {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    });
  }
} else {
  program.parse(process.argv);
}