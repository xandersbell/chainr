// 从 Portkey 的 src/utils/env.ts 适配而来
// 移除了 Hono Context 依赖，Chainr 是纯 Node.js SDK，直接读 process.env

// 如果值看起来像文件路径，尝试读取文件内容
function getValueOrFileContents(value?: string, ignore?: boolean): string | undefined {
  if (!value || ignore) return value;

  try {
    if (
      value.startsWith('/') ||
      value.startsWith('./') ||
      value.startsWith('../')
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
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

// Chainr 不需要 Hono Context，直接从 process.env 读取
export const Environment = () => ({
  AWS_ACCESS_KEY_ID: getValueOrFileContents(process.env.AWS_ACCESS_KEY_ID),
  AWS_SECRET_ACCESS_KEY: getValueOrFileContents(process.env.AWS_SECRET_ACCESS_KEY),
  AWS_SESSION_TOKEN: getValueOrFileContents(process.env.AWS_SESSION_TOKEN),
  AWS_ROLE_ARN: getValueOrFileContents(process.env.AWS_ROLE_ARN),
  AWS_PROFILE: getValueOrFileContents(process.env.AWS_PROFILE, true),
  AWS_WEB_IDENTITY_TOKEN_FILE: getValueOrFileContents(process.env.AWS_WEB_IDENTITY_TOKEN_FILE, true),
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: getValueOrFileContents(process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI, true),
  AWS_ASSUME_ROLE_ACCESS_KEY_ID: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_ACCESS_KEY_ID),
  AWS_ASSUME_ROLE_SECRET_ACCESS_KEY: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_SECRET_ACCESS_KEY),
  AWS_ASSUME_ROLE_REGION: getValueOrFileContents(process.env.AWS_ASSUME_ROLE_REGION),
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
