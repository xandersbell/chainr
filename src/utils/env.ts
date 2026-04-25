// Adapted from Portkey's src/utils/env.ts
// Removed Hono Context dependency - Priorai is a pure Node.js SDK, reads process.env directly

// If value looks like a file path, attempt to read file contents
function getValueOrFileContents(value?: string, ignore?: boolean): string | undefined {
  if (!value || ignore) return value;

  try {
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path');
      const resolvedPath = path.resolve(value);
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf8').trim();
      }
    }
    return value;
  } catch {
    return value;
  }
}

// Priorai does not need Hono Context - read directly from process.env
export const Environment = () => ({
  AWS_ACCESS_KEY_ID: getValueOrFileContents(process.env.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: getValueOrFileContents(process.env.AWS_SECRET_ACCESS_KEY),
  AWS_SESSION_TOKEN: getValueOrFileContents(process.env.AWS_SESSION_TOKEN),
  AWS_ROLE_ARN: getValueOrFileContents(process.env.AWS_ROLE_ARN),
  AWS_PROFILE: getValueOrFileContents(process.env.AWS_PROFILE, true),
  AWS_WEB_IDENTITY_TOKEN_FILE: getValueOrFileContents(
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    true,
  ),
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: getValueOrFileContents(
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
    true,
  ),
  AWS_ASSUME_ROLE_ACCESS_KEY_ID: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_ACCESS_KEY_ID),
  AWS_ASSUME_ROLE_SECRET_ACCESS_KEY: getValueOrFileContents(
    process.env.AWS_ASSUME_ROLE_SECRET_ACCESS_KEY,
  ),
  AWS_ASSUME_ROLE_REGION: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_REGION),
  AWS_ASSUME_ROLE_SOURCE_ARN: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_SOURCE_ARN),
  AWS_ASSUME_ROLE_SOURCE_EXTERNAL_ID: getValueOrFileContents(
    process.env.AWS_ASSUME_ROLE_SOURCE_EXTERNAL_ID,
  ),
  AWS_REGION: getValueOrFileContents(process.env.AWS_REGION),
  AWS_ENDPOINT_DOMAIN: getValueOrFileContents(process.env.AWS_ENDPOINT_DOMAIN),
  AWS_IMDS_V1: getValueOrFileContents(process.env.AWS_IMDS_V1),
  AZURE_AUTH_MODE: getValueOrFileContents(process.env.AZURE_AUTH_MODE),
  AZURE_ENTRA_CLIENT_ID: getValueOrFileContents(process.env.AZURE_ENTRA_CLIENT_ID),
  AZURE_ENTRA_CLIENT_SECRET: getValueOrFileContents(process.env.AZURE_ENTRA_CLIENT_SECRET),
  AZURE_ENTRA_TENANT_ID: getValueOrFileContents(process.env.AZURE_ENTRA_TENANT_ID),
  AZURE_MANAGED_CLIENT_ID: getValueOrFileContents(process.env.AZURE_MANAGED_CLIENT_ID),
  AZURE_MANAGED_VERSION: getValueOrFileContents(process.env.AZURE_MANAGED_VERSION),
  AZURE_IDENTITY_ENDPOINT: getValueOrFileContents(process.env.IDENTITY_ENDPOINT, true),
  AZURE_MANAGED_IDENTITY_HEADER: getValueOrFileContents(process.env.IDENTITY_HEADER),
  AZURE_AUTHORITY_HOST: getValueOrFileContents(process.env.AZURE_AUTHORITY_HOST),
  AZURE_TENANT_ID: getValueOrFileContents(process.env.AZURE_TENANT_ID),
  AZURE_CLIENT_ID: getValueOrFileContents(process.env.AZURE_CLIENT_ID),
  AZURE_FEDERATED_TOKEN_FILE: getValueOrFileContents(process.env.AZURE_FEDERATED_TOKEN_FILE),
  TRUSTED_CUSTOM_HOSTS: getValueOrFileContents(process.env.TRUSTED_CUSTOM_HOSTS),
});
