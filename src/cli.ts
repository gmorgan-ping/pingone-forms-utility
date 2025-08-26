#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from './config.js';
import { listForms, downloadForms, uploadForms } from './forms.js';
import { scanFormsDir } from './fsio.js';
import {
  selectMode,
  selectEnvironment,
  selectForms,
  selectLocalForms,
} from './ui.js';
import type { CliOptions } from './types.js';

// UI Helpers for better formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const formatTitle = (text: string): string =>
  `${colors.bright}${text}${colors.reset}`;

const formatSuccess = (text: string): string =>
  `${colors.green}✓ ${text}${colors.reset}`;

const formatError = (text: string): string =>
  `${colors.red}✗ ${text}${colors.reset}`;

const formatInfo = (text: string): string =>
  `${colors.dim}${text}${colors.reset}`;

const formatSection = (title: string): string =>
  `\n${colors.bright}=== ${title} ===${colors.reset}\n`;

const formatSubSection = (title: string): string =>
  `\n${colors.bright}${title}:${colors.reset}`;

const program = new Command();

program
  .name('p1-forms')
  .description('CLI tool for exporting and importing PingOne Forms')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options: CliOptions) => {
    try {
      await main(options);
    } catch (error) {
      console.error(
        'Error:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

async function main(options: CliOptions = {}): Promise<void> {
  const verbose = options.verbose || false;

  // Welcome message
  console.log(formatTitle('🚀 PingOne Forms CLI'));
  console.log('Export and import PingOne Forms between environments');
  console.log('');

  // Load and validate configuration
  let environments;
  try {
    environments = loadConfig();
    if (verbose) {
      console.log(formatInfo(`Loaded ${environments.length} environment(s)`));
    }
  } catch (error) {
    throw new Error(
      `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (environments.length === 0) {
    throw new Error('No environments found in configuration');
  }

  // Select operation mode
  console.log(formatSection('Operation Selection'));
  const mode = await selectMode();
  if (verbose) {
    console.log(formatInfo(`Selected mode: ${mode}`));
  }

  // Select environment
  console.log(formatSection('Environment Selection'));
  const environment = await selectEnvironment(environments, mode);
  if (verbose) {
    console.log(formatInfo(`Selected environment: ${environment.name}`));
  }

  if (mode === 'export') {
    await handleExport(environment, verbose);
  } else {
    await handleImport(environment, verbose);
  }
}

async function handleExport(
  environment: ReturnType<typeof loadConfig>[0],
  verbose: boolean
): Promise<void> {
  console.log(formatSection('Export Forms'));
  if (verbose) {
    console.log(formatInfo(`Starting export from environment: ${environment.name}`));
  }

  const spinner = ora('Loading forms from PingOne...').start();

  try {
    const forms = await listForms(environment, verbose);
    spinner.stop();

    if (forms.length === 0) {
      console.log('No forms found in the selected environment.');
      return;
    }

    console.log(`Found ${forms.length} form(s) in ${environment.name}`);
    const selectedForms = await selectForms(forms);

    if (selectedForms.length === 0) {
      console.log('No forms selected. Exiting.');
      return;
    }

    // Download the selected forms
    console.log(formatSection('Downloading Forms'));
    console.log(`Downloading ${selectedForms.length} form(s) from ${environment.name}...`);

    const downloadSpinner = ora('Downloading forms...').start();

    try {
      // Stop spinner before downloads to allow for prompts
      downloadSpinner.stop();

      const downloadedFiles = await downloadForms(environment, selectedForms, verbose);

      // Show success message
      console.log(formatSuccess('Forms downloaded successfully!'));

      // Print summary
      console.log(formatSection('Export Complete'));
      console.log(formatSubSection('Environment'));
      console.log(`  ${environment.name}`);
      console.log(formatSubSection(`Downloaded Forms (${downloadedFiles.length})`));
      selectedForms.forEach((form, index) => {
        const filePath = downloadedFiles[index];
        if (filePath) {
          console.log(formatSuccess(`${form.name} → ${filePath}`));
        }
      });
      console.log(`\nForms saved to ./forms/ directory`);

    } catch (error) {
      console.log(formatError('Failed to download forms'));
      throw error;
    }
  } catch (error) {
    spinner.fail('Failed to load forms');
    throw error;
  }
}

async function handleImport(
  environment: ReturnType<typeof loadConfig>[0],
  verbose: boolean
): Promise<void> {
  console.log(formatSection('Import Forms'));
  if (verbose) {
    console.log(formatInfo(`Starting import to environment: ${environment.name}`));
  }

  const spinner = ora('Scanning local forms directory...').start();

  try {
    const localForms = await scanFormsDir();
    spinner.stop();

    if (localForms.length === 0) {
      console.log('No JSON files found in ./forms directory.');
      console.log('Please ensure the ./forms directory exists and contains form JSON files.');
      return;
    }

    console.log(`Found ${localForms.length} form file(s) in ./forms directory`);
    const selectedForms = await selectLocalForms(localForms);

    if (selectedForms.length === 0) {
      console.log('No forms selected. Exiting.');
      return;
    }

    // Start the import process
    console.log(formatSection('Starting Import'));
    console.log(`Importing ${selectedForms.length} form(s) to ${environment.name}...`);

    try {
      const result = await uploadForms(environment, selectedForms, verbose);

      // Print summary
      console.log(formatSection('Import Complete'));
      console.log(formatSubSection('Target Environment'));
      console.log(`  ${environment.name}`);

      if (result.successful.length > 0) {
        console.log(formatSubSection(`✓ Successfully Imported (${result.successful.length})`));
        result.successful.forEach((filename) => {
          console.log(formatSuccess(filename));
        });
      }

      if (result.failed.length > 0) {
        console.log(formatSubSection(`✗ Failed to Import (${result.failed.length})`));
        result.failed.forEach((failure) => {
          console.log(formatError(`${failure.filename}: ${failure.error}`));
        });
      }

      console.log(`\nImport operation completed.`);

    } catch (error) {
      console.log(formatError('Import failed'));
      throw error;
    }
  } catch (error) {
    spinner.fail('Failed to scan forms directory');
    throw error;
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

program.parse();
