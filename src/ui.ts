import inquirer from 'inquirer';
import type { EnvConfig, OperationMode, FormSummary, LocalFormFile } from './types.js';

export async function selectMode(): Promise<OperationMode> {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'What would you like to do?',
      choices: [
        { name: 'Export PingOne Forms', value: 'export' },
        { name: 'Import PingOne Forms', value: 'import' },
      ],
    },
  ]);
  return mode;
}

export async function selectEnvironment(
  environments: EnvConfig[],
  mode: OperationMode
): Promise<EnvConfig> {
  const sortedEnvs = [...environments].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const message =
    mode === 'export'
      ? 'Select source environment:'
      : 'Select target environment:';

  const { env } = await inquirer.prompt([
    {
      type: 'list',
      name: 'env',
      message,
      choices: sortedEnvs.map((env) => ({
        name: env.name,
        value: env,
      })),
    },
  ]);
  return env;
}

export async function selectForms(forms: FormSummary[]): Promise<FormSummary[]> {
  if (forms.length === 0) {
    console.log('No forms found in the selected environment.');
    return [];
  }

  const { selectedForms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedForms',
      message: 'Select forms to export:',
      choices: forms.map((form) => ({
        name: form.name,
        value: form,
        checked: false,
      })),
      validate: (input: FormSummary[]) => {
        if (input.length === 0) {
          return 'Please select at least one form.';
        }
        return true;
      },
    },
  ]);
  return selectedForms;
}

export async function selectLocalForms(
  localForms: LocalFormFile[]
): Promise<LocalFormFile[]> {
  if (localForms.length === 0) {
    console.log('No JSON files found in ./forms directory.');
    return [];
  }

  const validForms = localForms.filter((form) => form.isValid);
  const invalidForms = localForms.filter((form) => !form.isValid);

  if (invalidForms.length > 0) {
    console.log('Warning: Found invalid JSON files:');
    invalidForms.forEach((form) => {
      console.log(`  - ${form.filename}: ${form.error}`);
    });
    console.log('');
  }

  if (validForms.length === 0) {
    console.log('No valid JSON files found in ./forms directory.');
    return [];
  }

  const { selectedForms } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedForms',
      message: 'Select forms to import:',
      choices: validForms.map((form) => ({
        name: form.name,
        value: form,
        checked: false,
      })),
      validate: (input: LocalFormFile[]) => {
        if (input.length === 0) {
          return 'Please select at least one form.';
        }
        return true;
      },
    },
  ]);
  return selectedForms;
}

export async function promptForFormName(
  currentName: string,
  filename: string,
  verbose = false
): Promise<string> {
  if (verbose) {
    console.log(`Prompting for name for form from file: ${filename}`);
  }

  const { formName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'formName',
      message: `Enter name for form (from ${filename}):`,
      default: currentName,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Form name cannot be empty.';
        }
        if (input.trim().length > 100) {
          return 'Form name cannot exceed 100 characters.';
        }
        return true;
      },
      filter: (input: string) => input.trim(),
    },
  ]);

  return formName;
}

export async function promptForOverwrite(
  filename: string,
  verbose = false
): Promise<boolean> {
  if (verbose) {
    console.log(`Prompting for overwrite confirmation for: ${filename}`);
  }

  const { shouldOverwrite } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldOverwrite',
      message: `File "${filename}" already exists. Overwrite?`,
      default: false,
    },
  ]);

  return shouldOverwrite;
}

export async function promptForMultipleFormNames(
  formsWithData: { localForm: LocalFormFile; formData: any }[],
  verbose = false
): Promise<Map<string, string>> {
  if (verbose) {
    console.log(`Prompting for names for ${formsWithData.length} forms`);
  }

  const nameMap = new Map<string, string>();

  console.log('\n=== Configure Form Names ===');
  console.log('You can customize the name for each form before import:\n');

  for (const { localForm, formData } of formsWithData) {
    const currentName = formData.name || localForm.name;
    const { formName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'formName',
        message: `Enter name for "${localForm.filename}":`,
        default: currentName,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Form name cannot be empty.';
          }
          if (input.trim().length > 100) {
            return 'Form name cannot exceed 100 characters.';
          }
          return true;
        },
        filter: (input: string) => input.trim(),
      },
    ]);

    nameMap.set(localForm.filename, formName);

    if (verbose) {
      console.log(`Set name for ${localForm.filename}: "${formName}"`);
    }
  }

  return nameMap;
}
