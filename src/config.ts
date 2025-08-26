import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import type { EnvConfig, RegionTLD } from './types.js';

const VALID_TLDS: RegionTLD[] = ['com', 'eu', 'ca', 'asia', 'com.au', 'sg'];

export function loadConfig(): EnvConfig[] {
  const envJsonPath = join(process.cwd(), 'environments.json');

  if (!existsSync(envJsonPath)) {
    throw new Error(
      'Missing environments.json file. Please create one based on environments.example.json'
    );
  }

  try {
    const jsonContent = readFileSync(envJsonPath, 'utf-8');
    const environments = JSON.parse(jsonContent);
    return validateAndParseEnvironments(environments);
  } catch (error) {
    throw new Error(
      `Error reading environments.json: ${error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

function validateAndParseEnvironments(environments: unknown): EnvConfig[] {
  if (!Array.isArray(environments)) {
    throw new Error('environments.json must contain a JSON array of environment objects');
  }

  return environments.map((env, index) => validateEnvironment(env, index));
}

function validateEnvironment(env: unknown, index: number): EnvConfig {
  if (!env || typeof env !== 'object') {
    throw new Error(`Environment at index ${index} is not a valid object`);
  }

  const envObj = env as Record<string, unknown>;
  const requiredFields = ['name', 'envId', 'clientId', 'clientSecret', 'tld'];

  for (const field of requiredFields) {
    if (!envObj[field] || typeof envObj[field] !== 'string') {
      throw new Error(
        `Environment at index ${index} is missing required field: ${field}`
      );
    }
  }

  const tld = envObj.tld as string;
  if (!VALID_TLDS.includes(tld as RegionTLD)) {
    throw new Error(
      `Environment at index ${index} has invalid tld: ${tld}. Must be one of: ${VALID_TLDS.join(
        ', '
      )}`
    );
  }

  // Validate envId is UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(envObj.envId as string)) {
    throw new Error(
      `Environment at index ${index} has invalid envId format. Must be a valid UUID.`
    );
  }

  return {
    name: envObj.name as string,
    envId: envObj.envId as string,
    clientId: envObj.clientId as string,
    clientSecret: envObj.clientSecret as string,
    tld: tld as RegionTLD,
  };
}

export function buildAuthUrl(envId: string, tld: RegionTLD): string {
  return `https://auth.pingone.${tld}/${envId}/as/token`;
}

export function buildApiUrl(tld: RegionTLD): string {
  return `https://api.pingone.${tld}/v1`;
}
