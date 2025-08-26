import { listForms as apiListForms, downloadForm, uploadForm } from './api.js';
import { saveFormToFile, loadFormFromFile } from './fsio.js';
import { promptForMultipleFormNames, promptForOverwrite } from './ui.js';
import type { EnvConfig, FormSummary, LocalFormFile } from './types.js';

export async function listForms(
  env: EnvConfig,
  verbose = false
): Promise<FormSummary[]> {
  return apiListForms(env, verbose);
}

export async function downloadForms(
  env: EnvConfig,
  forms: FormSummary[],
  verbose = false
): Promise<string[]> {
  const downloadedFiles: string[] = [];

  for (const form of forms) {
    if (verbose) {
      console.log(`Downloading form: ${form.name} (${form.id})`);
    }

    try {
      // Download form data from API
      const rawFormData = await downloadForm(env, form.id, verbose);

      // Transform form data by removing unwanted fields
      const cleanedFormData = transformFormForExport(rawFormData, verbose);

      // Generate filename from form name (sanitized)
      const sanitizedName = form.name
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase();

      const filename = `${sanitizedName}.json`;

      // Save transformed form to file
      const filePath = await saveFormToFile(cleanedFormData, filename, verbose, promptForOverwrite);
      if (filePath) { // Only add if file was actually saved
        downloadedFiles.push(filePath);
      }

    } catch (error) {
      throw new Error(
        `Failed to download form "${form.name}" (${form.id}): ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return downloadedFiles;
}

function transformFormForExport(formData: any, verbose = false): any {
  if (verbose) {
    console.log('Transforming form data for export...');
  }

  // Create a copy to avoid mutating the original
  const transformed = { ...formData };

  // Remove the fields that should not be exported
  delete transformed._links;
  delete transformed.id;
  delete transformed.environment;
  delete transformed.created;
  delete transformed.modified;

  if (verbose) {
    const removedFields = ['_links', 'id', 'environment', 'created', 'modified'];
    console.log(`Removed fields: ${removedFields.join(', ')}`);
  }

  return transformed;
}

export async function uploadForms(
  env: EnvConfig,
  localForms: LocalFormFile[],
  verbose = false
): Promise<{ successful: string[]; failed: { filename: string; error: string }[] }> {
  const successful: string[] = [];
  const failed: { filename: string; error: string }[] = [];

  // First, load all form data and collect names
  const formsWithData: { localForm: LocalFormFile; formData: any }[] = [];

  console.log('Loading form data...');
  for (const localForm of localForms) {
    try {
      const formData = await loadFormFromFile(localForm.filename, verbose);
      formsWithData.push({ localForm, formData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({
        filename: localForm.filename,
        error: `Failed to load file: ${errorMessage}`,
      });
    }
  }

  if (formsWithData.length === 0) {
    return { successful, failed };
  }

  // Collect all form names upfront
  const nameMap = await promptForMultipleFormNames(formsWithData, verbose);

  // Now upload all forms with their configured names
  console.log('\n=== Starting Upload ===');
  for (const { localForm, formData } of formsWithData) {
    const formName = nameMap.get(localForm.filename) || formData.name || localForm.name;

    if (verbose) {
      console.log(`Processing form: ${localForm.name} (${localForm.filename})`);
    }

    try {
      // Update form name in the data
      const updatedFormData = {
        ...formData,
        name: formName,
      };

      if (verbose) {
        console.log(`Uploading form "${formName}" to ${env.name}...`);
      }

      // Upload form to PingOne
      await uploadForm(env, updatedFormData, verbose);
      successful.push(localForm.filename);

      console.log(`✓ Successfully uploaded: ${formName}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({
        filename: localForm.filename,
        error: errorMessage,
      });

      console.log(`✗ Failed to upload ${localForm.filename}: ${errorMessage}`);
    }
  }

  return { successful, failed };
}
