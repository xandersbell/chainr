# Chainr Provider Support Evaluation

**Date**: 2026-04-23
**Status**: Phase 1 & 2 Complete (135 tests passing)
**Purpose**: Document current provider support, gaps, and recommendations

---

## 0. Executive Summary

Chainr currently supports 4 providers with basic transform implementations. While functional for common use cases, there are notable gaps in advanced authentication, provider-specific parameters, and error handling that may limit effectiveness in production environments.

### Current Support Matrix

| Provider | Request Transform | Response Transform | Auth Method | Status |
|----------|-------------------|-------------------|-------------|--------|
| OpenAI | ✅ Pass-through | ✅ Pass-through | Bearer Token | Production Ready |
| Anthropic | ✅ Custom format | ✅ Custom format | X-API-Key | Production Ready |
| Google Vertex AI | ⚠️ Basic | ⚠️ Basic | Bearer Token | Needs Improvement |
| OpenRouter | ✅ OpenAI-compatible | ✅ Pass-through | Bearer Token | Production Ready |

---

## 1. Provider Analysis

### 1.1 OpenAI

**API Format**: OpenAI-compatible REST API
**Endpoint**: `https://api.openai.com/v1/chat/completions`

#### Current Implementation
```typescript
headers['Authorization'] = `Bearer ${key}`;
url: 'https://api.openai.com/v1/chat/completions'
body: { model, messages, ...filterParams }
```

#### Context7 Documentation Verification
- ✅ Bearer token authentication correct
- ✅ Endpoint format correct
- ✅ Request body structure matches (model, messages, temperature, max_tokens, tools, etc.)
- ✅ Response format pass-through correct

#### Gaps
- None identified - OpenAI implementation is complete

---

### 1.2 Anthropic

**API Format**: Custom Messages API
**Endpoint**: `https://api.anthropic.com/v1/messages`

#### Current Implementation
```typescript
headers['X-API-Key'] = key;
headers['anthropic-beta'] = betaHeader;
headers['anthropic-version'] = version;
url: 'https://api.anthropic.com/v1/messages'
body: { model, messages, max_tokens }
```

#### Context7 Documentation Verification
- ✅ X-API-Key header correct
- ✅ anthropic-beta header (default: `messages-2023-12-15`) correct
- ✅ anthropic-version header (default: `2023-06-01`) correct
- ✅ Endpoint correct
- ⚠️ **GAP**: `max_tokens` is required but we default to 1024 - may be insufficient for some use cases
- ⚠️ **GAP**: streaming not supported in current implementation

#### Anthropic Response Transform
```typescript
// Current implementation maps:
id: data.id
model: data.model
content: data.content[0].text
finish_reason: data.stop_reason
usage: { input_tokens, output_tokens }
```

#### Context7 Response Verification
- ✅ Response structure matches
- ✅ Content extraction from `content[0].text` correct
- ✅ Usage mapping from `input_tokens`/`output_tokens` correct

---

### 1.3 Google Vertex AI

**API Format**: Google AI REST API with Vertex AI specifics
**Endpoint**: `https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent`

#### Current Implementation
```typescript
headers['Authorization'] = `Bearer ${key}`;
url: `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`
body: { contents: params.messages }
```

#### Context7 Documentation Verification
- ✅ URL format correct for Vertex AI
- ✅ Bearer token auth correct
- ⚠️ **GAP**: Vertex AI supports multiple auth methods:
  1. API Key (currently implemented)
  2. Service Account OAuth (not implemented)
  3. Workload Identity (not implemented - critical for GCP production)
- ⚠️ **GAP**: `contents` vs our direct message passthrough - need to verify structure mapping
- ⚠️ **GAP**: Vertex AI uses `modelVersion` not `model` in response

#### Vertex AI Request Format (from Context7)
```python
response = client.models.generate_content(
    model='gemini-2.0-flash',  # Supports multiple model name formats
    contents='What is a good name for a flower shop?'
)
# Or with Vertex:
client = genai.Client(
    vertexai=True,
    project='my-project-id',
    location='us-central1'
)
```

#### Issues Found
1. **Auth Gap**: Production GCP deployments typically use Workload Identity or Service Accounts, not API keys
2. **Model Format**: Vertex uses resource names like `projects/{project}/locations/{region}/publishers/google/models/{model}`
3. **Contents Structure**: Vertex uses `contents` with specific Content object structure, not raw messages

---

### 1.4 OpenRouter

**API Format**: OpenAI-compatible with custom headers
**Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

#### Current Implementation
```typescript
headers['Authorization'] = `Bearer ${key}`;
headers['HTTP-Referer'] = 'https://chainr.dev/';
headers['X-Title'] = POWERED_BY;
url: 'https://openrouter.ai/api/v1/chat/completions'
```

#### Context7 Documentation Verification
- ✅ Bearer token correct
- ✅ URL correct
- ✅ `HTTP-Referer` header correct (optional but recommended)
- ⚠️ **GAP**: OpenRouter docs show `X-OpenRouter-Title` as the preferred header for site title
- ✅ Model passthrough works (openrouter/auto, provider/model format)

#### OpenRouter Specific Features
- Model fallbacks: can specify `models: ['model1', 'model2']` for automatic failover
- Not currently utilized in Chainr

---

## 2. Potential Additional Providers

### 2.1 Cohere

**API Format**: OpenAI-compatible + native Chat API
**Endpoint**: `https://api.cohere.ai/v1/chat` (native) or `https://api.cohere.ai/compatibility/v1/chat/completions` (OpenAI-compatible)

#### Analysis
- Has OpenAI-compatible endpoint (`/compatibility/v1/chat/completions`)
- Native endpoint uses different format (`message` not `messages`)
- Auth: `Authorization: Bearer {key}`
- **Recommendation**: Could add as OpenAI-compatible with passthrough

---

### 2.2 Mistral AI

**API Format**: OpenAI-compatible
**Endpoint**: `https://api.mistral.ai/v1/chat/completions`

#### Analysis
- OpenAI-compatible API format
- Auth: `Authorization: Bearer {key}`
- Request/response format identical to OpenAI
- **Recommendation**: Could add as OpenAI-compatible with passthrough

---

### 2.3 AWS Bedrock

**API Format**: Custom per model (Claude, Titan, Mistral, etc.)
**Endpoint**: `https://bedrock.{region}.amazonaws.com/`

#### Analysis
- **Major Gap**: Requires AWS Signature Version 4 signing - not simple Bearer token
- Supports: Claude, Titan, Mistral, Jurassic, Command, and more
- Each model has different request/response format
- **Recommendation**: Not suitable for Phase 1 - requires dedicated implementation with AWS SDK

---

### 2.4 Azure OpenAI

**API Format**: OpenAI-compatible with Azure-specific auth
**Endpoint**: `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}`

#### Analysis
- Uses Azure AD credentials or API key
- Requires `api-version` query parameter
- **Recommendation**: Could add after basic OpenAI implementation - would need Azure AD token provider

---

## 3. Identified Gaps Summary

### Critical Gaps (Affecting Production Use)

| Provider | Issue | Severity | Impact |
|----------|-------|----------|--------|
| Vertex AI | Only supports API key auth, not GCP service accounts | High | Cannot use in production GCP environments |
| Anthropic | max_tokens default may be insufficient | Medium | Truncated responses |
| All providers | No streaming support | High | Cannot handle SSE responses |

### Medium Gaps (Feature Limitations)

| Provider | Issue | Severity | Impact |
|----------|-------|----------|--------|
| OpenRouter | Using `X-Title` instead of `X-OpenRouter-Title` | Low | May affect OpenRouter rankings |
| Vertex AI | Model name format not validated | Low | Wrong model may be called |
| All providers | No request timeout configuration | Medium | Hanging requests |

### Low Gaps (Documentation/Defaults)

| Provider | Issue | Severity | Impact |
|----------|-------|----------|--------|
| Anthropic | streaming not documented as unsupported | Low | API mismatch expectation |
| All | No retry budget/cost tracking | Low | Cost optimization not possible |

---

## 4. Recommendations

### Immediate (Phase 3)

1. **Fix Vertex AI Auth**: Add support for OAuth/Service Account token acquisition for GCP production use
2. **Add Streaming Support**: Implement SSE response handling for real-time use cases
3. **Update OpenRouter Headers**: Change `X-Title` to `X-OpenRouter-Title` for better compatibility

### Short-term (Phase 4)

4. **Add Cohere Support**: Via OpenAI-compatible endpoint
5. **Add Mistral AI Support**: Via OpenAI-compatible endpoint
6. **Add Azure OpenAI Support**: Via Azure-specific endpoint with AD auth

### Long-term (Future Phases)

7. **AWS Bedrock Support**: Requires dedicated implementation with AWS Signature V4 signing
8. **Nested Strategy Enhancement**: Currently limited to target-level, not provider-level
9. **Cost-based Routing**: Add cost optimization based on provider pricing

---

## 5. Implementation Quality Assessment

### Current Provider Implementation Quality

| Provider | Transform Quality | Error Handling | Edge Cases | Overall |
|----------|-------------------|----------------|------------|---------|
| OpenAI | ✅ Excellent | ✅ Good | ✅ Good | **A** |
| Anthropic | ✅ Good | ✅ Good | ⚠️ max_tokens | **B+** |
| Vertex AI | ⚠️ Basic | ⚠️ Auth gap | ⚠️ Auth gap | **C** |
| OpenRouter | ✅ Excellent | ✅ Good | ⚠️ Headers | **B+** |

### Technical Debt

1. **Error Response Consistency**: All providers return ErrorResponse but structure varies
2. **No Request Validation**: Before sending to provider
3. **No Response Schema Validation**: Assuming valid responses
4. **Config Coupling**: Provider options tightly coupled to implementation

---

## 6. Next Steps

### For Phase 3 (Advanced Features)
- [ ] Add streaming support (SSE handling)
- [ ] Fix Vertex AI OAuth support
- [ ] Update OpenRouter headers
- [ ] Add request validation

### For Phase 4 (Firebase Integration)
- [ ] Add GCP service account auth for Vertex AI
- [ ] Add Firebase Functions example
- [ ] Test with real provider credentials

### Future Enhancements
- [ ] Cohere provider support
- [ ] Mistral AI provider support
- [ ] Azure OpenAI support
- [ ] AWS Bedrock support (if demand exists)