export type RegionTLD = 'com' | 'eu' | 'ca' | 'asia' | 'com.au' | 'sg';

export interface EnvConfig {
  name: string;
  envId: string;
  clientId: string;
  clientSecret: string;
  tld: RegionTLD;
}

export interface FormSummary {
  id: string;
  name: string;
  description?: string;
}

export interface LocalFormFile {
  filename: string;
  name: string;
  isValid: boolean;
  error?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TokenCache {
  token: string;
  expiresAt: number;
}

export interface CliOptions {
  verbose?: boolean;
}

export type OperationMode = 'export' | 'import';
