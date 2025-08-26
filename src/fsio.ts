import { readdir, readFile, access, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { LocalFormFile } from './types.js';

const FORMS_DIR = './forms';

export async function scanFormsDir(): Promise<LocalFormFile[]> {
  try {
    // Check if forms directory exists
    await access(FORMS_DIR);
  } catch {
    return []; // Directory doesn't exist
  }

  try {
    const files = await readdir(FORMS_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return [];
    }

    const formFiles: LocalFormFile[] = [];

    for (const filename of jsonFiles) {
      const filePath = join(FORMS_DIR, filename);
      const name = filename.replace('.json', '');

      try {
        const content = await readFile(filePath, 'utf-8');
        JSON.parse(content); // Validate JSON
        formFiles.push({
          filename,
          name,
          isValid: true,
        });
      } catch (error) {
        formFiles.push({
          filename,
          name,
          isValid: false,
          error:
            error instanceof Error ? error.message : 'Invalid JSON format',
        });
      }
    }

    return formFiles.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw new Error(
      `Failed to scan forms directory: ${error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function saveFormToFile(
  formData: any,
  filename: string,
  verbose = false,
  promptForOverwrite?: (filename: string, verbose?: boolean) => Promise<boolean>
): Promise<string> {
  try {
    // Ensure forms directory exists
    try {
      await access(FORMS_DIR);
    } catch {
      if (verbose) {
        console.log(`Creating forms directory: ${FORMS_DIR}`);
      }
      await mkdir(FORMS_DIR, { recursive: true });
    }

    const filePath = join(FORMS_DIR, filename);

    // Check if file already exists
    let fileExists = false;
    try {
      await access(filePath);
      fileExists = true;
    } catch {
      // File doesn't exist, which is fine
    }

    // If file exists and we have a prompt function, ask for confirmation
    if (fileExists && promptForOverwrite) {
      const shouldOverwrite = await promptForOverwrite(filename, verbose);
      if (!shouldOverwrite) {
        if (verbose) {
          console.log(`User chose not to overwrite: ${filePath}`);
        }
        return ''; // Return empty string to indicate skipped
      }
    }

    const jsonContent = JSON.stringify(formData, null, 2);
    await writeFile(filePath, jsonContent, 'utf-8');

    if (verbose) {
      const action = fileExists ? 'Overwrote' : 'Saved form to';
      console.log(`${action}: ${filePath}`);
    }

    return filePath;
  } catch (error) {
    throw new Error(
      `Failed to save form to file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function loadFormFromFile(
  filename: string,
  verbose = false
): Promise<any> {
  try {
    const filePath = join(FORMS_DIR, filename);

    if (verbose) {
      console.log(`Loading form from: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const formData = JSON.parse(content);

    if (verbose) {
      console.log(`Successfully loaded form: ${formData.name || 'Unknown'}`);
    }

    return formData;
  } catch (error) {
    throw new Error(
      `Failed to load form from file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
