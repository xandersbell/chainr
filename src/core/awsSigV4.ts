import { createHmac, createHash } from 'crypto';

export async function generateAWSHeaders(
  body: string | undefined,
  headers: Record<string, string>,
  url: string,
  method: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsSessionToken: string | undefined
): Promise<Record<string, string>> {
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  const now = new Date();
  const amzDate = formatDateTime(now);
  const dateStamp = formatDate(now);

  const signedHeaders = new Headers(headers);
  signedHeaders.set('host', host);
  signedHeaders.set('x-amz-date', amzDate);

  if (awsSessionToken) {
    signedHeaders.set('x-amz-security-token', awsSessionToken);
  }

  let payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  if (body && body.length > 0) {
    payloadHash = createHash('sha256').update(body).digest('hex');
  }

  const canonicalUri = urlObj.pathname || '/';
  const canonicalQuerystring = urlObj.search || '';
  const signedHeaderNames = Array.from(signedHeaders.keys())
    .sort()
    .map((k) => k.toLowerCase())
    .join(';');

  const canonicalHeaders = Array.from(signedHeaders.entries())
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}`)
    .join('\n');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    '',
    signedHeaderNames,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${awsRegion}/bedrock/aws4_request`;
  const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const signingKey = getSignatureKey(awsSecretAccessKey, dateStamp, awsRegion, 'bedrock');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = [
    `${algorithm} Credential=${awsAccessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaderNames}`,
    `Signature=${signature}`,
  ].join(', ');

  const result: Record<string, string> = {};
  signedHeaders.forEach((value, key) => {
    result[key] = value;
  });
  result['Authorization'] = authorizationHeader;

  return result;
}

export const getAwsEndpointDomain = (): string => 'amazonaws.com';

export const getBedrockModelWithoutRegion = (model: string): string => {
  return model.replace(/^(us\.|eu\.|apac\.|au\.|ca\.|jp\.|global\.)/, '');
};

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 8);
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kSecret = Buffer.from('AWS4' + secretAccessKey, 'utf8');
  const kDate = createHmac('sha256', kSecret).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update(service).digest();
  return createHmac('sha256', kService).update('aws4_request').digest();
}
