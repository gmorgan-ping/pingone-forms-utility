import axios, { AxiosError } from 'axios';
import { buildAuthUrl } from './config.js';
import type { EnvConfig, TokenResponse, TokenCache } from './types.js';

const tokenCache = new Map<string, TokenCache>();

export async function getAccessToken(
  env: EnvConfig,
  verbose = false
): Promise<string> {
  const cacheKey = `${env.envId}:${env.clientId}`;
  const cached = tokenCache.get(cacheKey);

  // Check if we have a valid cached token
  if (cached && cached.expiresAt > Date.now() + 30000) {
    // 30 second buffer
    if (verbose) {
      console.log(`Using cached token for ${env.name}`);
    }
    return cached.token;
  }

  if (verbose) {
    console.log(`Requesting new token for ${env.name}...`);
  }

  const authUrl = buildAuthUrl(env.envId, env.tld);
  const credentials = Buffer.from(
    `${env.clientId}:${env.clientSecret}`
  ).toString('base64');

  try {
    const response = await axios.post<TokenResponse>(
      authUrl,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const { access_token, expires_in } = response.data;
    const expiresAt = Date.now() + expires_in * 1000;

    // Cache the token
    tokenCache.set(cacheKey, {
      token: access_token,
      expiresAt,
    });

    if (verbose) {
      console.log(`Successfully obtained token for ${env.name}`);
    }

    return access_token;
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.error_description || error.message;

      if (status === 401) {
        throw new Error(
          `Authentication failed for ${env.name}: Invalid client credentials`
        );
      } else if (status === 403) {
        throw new Error(
          `Access denied for ${env.name}: Insufficient permissions`
        );
      } else {
        throw new Error(
          `Failed to authenticate with ${env.name}: ${message}`
        );
      }
    }
    throw new Error(`Network error while authenticating with ${env.name}`);
  }
}
