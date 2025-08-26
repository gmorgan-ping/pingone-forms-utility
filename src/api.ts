import axios, { AxiosError } from 'axios';
import { buildApiUrl } from './config.js';
import { getAccessToken } from './auth.js';
import type { EnvConfig, FormSummary } from './types.js';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

export async function createApiClient(
  env: EnvConfig,
  verbose = false
): Promise<ReturnType<typeof axios.create>> {
  const baseURL = buildApiUrl(env.tld);
  const token = await getAccessToken(env, verbose);

  const client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  // Add retry interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as typeof error.config & {
        _retryCount?: number;
      };

      if (!config) return Promise.reject(error);

      config._retryCount = config._retryCount || 0;

      // Retry on 429 (rate limit) or 5xx errors
      const shouldRetry =
        (error.response?.status === 429 ||
          (error.response?.status && error.response.status >= 500)) &&
        config._retryCount < MAX_RETRIES;

      if (shouldRetry) {
        config._retryCount++;
        const delay = BASE_DELAY * Math.pow(2, config._retryCount - 1);

        if (verbose) {
          console.log(
            `Retrying request (attempt ${config._retryCount}/${MAX_RETRIES}) after ${delay}ms...`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        return client(config);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

export async function listForms(
  env: EnvConfig,
  verbose = false
): Promise<FormSummary[]> {
  try {
    const client = await createApiClient(env, verbose);
    const forms: FormSummary[] = [];
    let url = `/environments/${env.envId}/forms`;

    // Handle pagination
    while (url) {
      if (verbose) {
        console.log(`Fetching: ${url}`);
      }

      const response = await client.get(url);
      const data = response.data;

      // Add forms from current page
      if (data._embedded?.forms) {
        const pageForms = data._embedded.forms.map((form: any) => ({
          id: form.id,
          name: form.name,
          description: form.description,
        }));
        forms.push(...pageForms);
      }

      // Check for next page
      url = data._links?.next?.href || null;
      if (url && url.startsWith('http')) {
        // Convert absolute URL to relative path
        const urlObj = new URL(url);
        url = urlObj.pathname + urlObj.search;
      }
    }

    return forms.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        throw new Error(
          `Authentication failed for ${env.name}: Token may have expired`
        );
      } else if (status === 403) {
        throw new Error(
          `Access denied for ${env.name}: Insufficient permissions to list forms`
        );
      } else if (status === 404) {
        throw new Error(`Forms endpoint not found for ${env.name}`);
      } else {
        throw new Error(`API error for ${env.name}: ${message}`);
      }
    }
    throw new Error(`Network error while fetching forms from ${env.name}`);
  }
}

export async function downloadForm(
  env: EnvConfig,
  formId: string,
  verbose = false
): Promise<any> {
  if (verbose) {
    console.log(`Downloading form ${formId} from environment ${env.name}...`);
  }

  try {
    const client = await createApiClient(env, verbose);
    const url = `/environments/${env.envId}/forms/${formId}`;

    if (verbose) {
      console.log(`Making GET request to: ${client.defaults.baseURL}${url}`);
      console.log(`Authorization header: Bearer ${client.defaults.headers.Authorization?.toString().substring(0, 20)}...`);
    }

    const response = await client.get(url);

    if (verbose) {
      console.log(`Successfully downloaded form ${formId}`);
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        throw new Error(
          `Authentication failed for ${env.name}: Token may have expired`
        );
      } else if (status === 403) {
        throw new Error(
          `Access denied for ${env.name}: Insufficient permissions to download form ${formId}`
        );
      } else if (status === 404) {
        throw new Error(`Form ${formId} not found in ${env.name}`);
      } else {
        throw new Error(`API error downloading form ${formId} from ${env.name}: ${message}`);
      }
    }
    throw new Error(`Network error while downloading form ${formId} from ${env.name}`);
  }
}

export async function uploadForm(
  env: EnvConfig,
  formData: any,
  verbose = false
): Promise<any> {
  if (verbose) {
    console.log(`Uploading form "${formData.name}" to environment ${env.name}...`);
  }

  try {
    const client = await createApiClient(env, verbose);
    const url = `/environments/${env.envId}/forms`;

    if (verbose) {
      console.log(`Making POST request to: ${client.defaults.baseURL}${url}`);
    }

    const response = await client.post(url, formData);

    if (verbose) {
      console.log(`Successfully uploaded form "${formData.name}"`);
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) {
        throw new Error(
          `Authentication failed for ${env.name}: Token may have expired`
        );
      } else if (status === 403) {
        throw new Error(
          `Access denied for ${env.name}: Insufficient permissions to upload forms`
        );
      } else if (status === 400) {
        throw new Error(`Invalid form data for "${formData.name}": ${message}`);
      } else if (status === 409) {
        throw new Error(`Form "${formData.name}" already exists in ${env.name} or there's a conflict`);
      } else {
        throw new Error(`API error uploading form "${formData.name}" to ${env.name}: ${message}`);
      }
    }
    throw new Error(`Network error while uploading form "${formData.name}" to ${env.name}`);
  }
}
