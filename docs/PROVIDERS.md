# Providers Registry

Updated: 2026-04-29 01:55:42 EEST

This document is the current full provider inventory for Priorai, based on the live `src/providers/index.ts` registry and provider endpoint configs.

## Summary

| Capability | Count |
|------------|-------|
| Registered providers | 72 |
| Chat completions | 61 ✅ |
| Streaming chat completions | 56 ✅ |
| Legacy completions | 25 ✅ |
| Embeddings | 30 ✅ |
| Image generation | 15 ✅ |
| Image editing | 4 ✅ |
| Audio transcription | 7 ✅ |
| Speech synthesis | 5 ✅ |
| Audio translation | 5 ✅ |
| Dedicated 3D providers | 2 ✅ |

## Core Providers

These are the primary providers highlighted in the README.

| Provider | Chat | Streaming | Embeddings | Image Gen | Chat Image | Chat Audio | Chat Video | Chat Docs | Audio API | Translation | Notes |
|----------|------|-----------|------------|-----------|------------|------------|------------|-----------|-----------|-------------|-------|
| OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | Broadest OpenAI-style surface |
| Anthropic | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | Native Messages API and structured output support |
| Google AI | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — | Gemini REST API |
| Google Vertex AI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | Gemini + Vertex endpoint routing |
| Azure OpenAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | Azure deployment-based routing |
| Azure AI Inference | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | Foundry / serverless inference endpoints |
| AWS Bedrock | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | SigV4 signing, Converse + model-specific routing |
| OpenRouter | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | — | — | OpenAI-compatible routing layer |

## Chat Completion Providers

All providers below have explicit `chatComplete` routing in the current codebase. The `Streaming` column reflects runtime streaming support in Priorai, including OpenAI-compatible passthrough streaming where applicable.

| Provider | Streaming | Notes |
|----------|-----------|-------|
| OpenAI | ✅ | Direct OpenAI-compatible chat completions |
| Anthropic | ✅ | Native Anthropic transforms |
| Google AI | ✅ | Gemini-native transforms |
| Google Vertex AI | ✅ | Dynamic routing by Vertex model family |
| Azure OpenAI | ✅ | Streams through the OpenAI-compatible runtime stream path |
| Azure AI Inference | ✅ | Includes Foundry and Anthropic-model variants |
| GitHub Models | ✅ | Shares Azure AI Inference implementation path |
| AWS Bedrock | ✅ | Converse + model-family-specific transforms |
| Cohere | ✅ | Dedicated stream transform |
| Groq | ✅ | OpenAI-compatible plus audio endpoints |
| DeepSeek | ✅ | OpenAI-compatible plus provider-specific transforms |
| Mistral AI | ✅ | Dedicated Mistral transforms |
| Together AI | ✅ | OpenAI-compatible |
| OpenRouter | ✅ | OpenRouter-specific streaming transform |
| Perplexity AI | ✅ | OpenAI-compatible |
| Fireworks AI | ✅ | OpenAI-compatible plus embeddings and images |
| Hugging Face | ✅ | OpenAI-compatible |
| Databricks | — | Workspace-based routing |
| Latitude | ✅ | Developer role mapped to system |
| 302.AI | ✅ | OpenAI-compatible |
| AI21 | ✅ | Chat, legacy completions, embeddings |
| AI Badgr | ✅ | OpenAI-compatible |
| Anyscale | ✅ | Chat, completions, embeddings |
| Bytez | ✅ | Dedicated Bytez transforms |
| Cerebras | ✅ | OpenAI-compatible chat |
| CometAPI | ✅ | Chat + embeddings |
| Cortex | — | Chat, completions, embeddings |
| DashScope | ✅ | Chat + embeddings |
| DeepBricks | ✅ | Chat + images |
| DeepInfra | ✅ | Chat only |
| Featherless AI | ✅ | Chat + completions |
| Hyperbolic | ✅ | Chat + images |
| Inference Net | ✅ | Chat only |
| IO Intelligence | ✅ | Chat + embeddings |
| Kluster AI | ✅ | Chat + embeddings |
| Krutrim | — | Chat only |
| Lambda | ✅ | Chat + completions |
| LemonFox AI | ✅ | Chat + transcription + images |
| Lepton | ✅ | Chat + completions + transcription |
| Lingyi | ✅ | Chat only |
| Matter AI | ✅ | Chat only |
| Modal | ✅ | Chat + completions |
| MonsterAPI | — | Chat only |
| Moonshot | ✅ | Chat only |
| NCompass | ✅ | Chat only |
| Nebius | ✅ | Chat + completions + embeddings |
| NextBit | ✅ | Chat + completions |
| Novita AI | ✅ | Chat + completions |
| Ollama | ✅ | Chat + embeddings |
| Oracle | ✅ | Chat only |
| OVHcloud | ✅ | Chat only |
| Palm | — | Chat + completions + embeddings |
| Predibase | ✅ | Chat only |
| Reka AI | ✅ | Chat only |
| SambaNova | ✅ | Chat only |
| SiliconFlow | ✅ | Chat + embeddings + images |
| Upstage | ✅ | Chat + embeddings |
| Workers AI | ✅ | Chat + completions + embeddings + images |
| xAI | ✅ | Chat + completions + embeddings |
| Z AI | ✅ | Chat only |
| Zhipu | ✅ | Chat + embeddings |

## Embeddings Providers

| Provider | Support | Notes |
|----------|---------|-------|
| OpenAI | ✅ | `api.openai.com/v1/embeddings` |
| Google AI | ✅ | Gemini embeddings |
| Google Vertex AI | ✅ | Vertex prediction endpoint |
| Azure OpenAI | ✅ | Azure embeddings |
| Azure AI Inference | ✅ | Foundry embeddings |
| GitHub Models | ✅ | GitHub-hosted Azure AI Inference path |
| AWS Bedrock | ✅ | Titan / Cohere model-family-dependent |
| Cohere | ✅ | `v2/embed` |
| Mistral AI | ✅ | Native Mistral embeddings |
| Together AI | ✅ | OpenAI-compatible embeddings |
| Fireworks AI | ✅ | OpenAI-compatible embeddings |
| Workers AI | ✅ | Cloudflare Workers AI embeddings |
| SiliconFlow | ✅ | OpenAI-compatible embeddings |
| AI21 | ✅ | Native AI21 embeddings |
| Anyscale | ✅ | OpenAI-compatible embeddings |
| DashScope | ✅ | OpenAI-compatible embeddings |
| Databricks | ✅ | Workspace embeddings |
| IO Intelligence | ✅ | OpenAI-compatible embeddings |
| Jina | ✅ | Native Jina embeddings |
| Kluster AI | ✅ | OpenAI-compatible embeddings |
| Nebius | ✅ | OpenAI-compatible embeddings |
| Nomic | ✅ | Native Nomic embeddings |
| Ollama | ✅ | Native Ollama embeddings |
| Palm | ✅ | Legacy Google PaLM embeddings |
| Upstage | ✅ | OpenAI-compatible embeddings |
| Voyage | ✅ | Native Voyage embeddings |
| Cortex | ✅ | OpenAI-compatible embeddings |
| CometAPI | ✅ | OpenAI-compatible embeddings |
| xAI | ✅ | OpenAI-compatible embeddings |
| Zhipu | ✅ | Native Zhipu embeddings |

## Image Generation Providers

| Provider | Support | Notes |
|----------|---------|-------|
| OpenAI | ✅ | `images/generations` |
| Azure OpenAI | ✅ | Azure image generation |
| Azure AI Inference | ✅ | Foundry image generation |
| GitHub Models | ✅ | Shares Azure AI Inference implementation path |
| AWS Bedrock | ✅ | Model-family-dependent image generation |
| Google Vertex AI | ✅ | Vertex prediction endpoint |
| Workers AI | ✅ | Cloudflare Workers AI |
| SiliconFlow | ✅ | OpenAI-compatible image endpoint |
| Fireworks AI | ✅ | OpenAI-compatible image endpoint |
| Hyperbolic | ✅ | OpenAI-compatible image endpoint |
| LemonFox AI | ✅ | Dedicated image generation endpoint |
| DeepBricks | ✅ | Dedicated image generation endpoint |
| Recraft AI | ✅ | Native Recraft endpoint |
| Stability AI | ✅ | Native Stability endpoint |
| Segmind | ✅ | Model-path style image routing |

## Audio, Speech, Translation, 3D

| Capability | Provider | Support | Notes |
|------------|----------|---------|-------|
| Audio transcription | OpenAI | ✅ | `audio/transcriptions` |
| Audio transcription | Azure OpenAI | ✅ | Azure audio transcription |
| Audio transcription | Azure AI Inference | ✅ | Foundry audio transcription |
| Audio transcription | GitHub Models | ✅ | Shares Azure AI Inference implementation path |
| Audio transcription | Groq | ✅ | OpenAI-compatible transcription path |
| Audio transcription | LemonFox AI | ✅ | Dedicated transcription endpoint |
| Audio transcription | Lepton | ✅ | Dedicated transcription endpoint |
| Speech synthesis | OpenAI | ✅ | `audio/speech` |
| Speech synthesis | Azure OpenAI | ✅ | Azure speech synthesis |
| Speech synthesis | Azure AI Inference | ✅ | Foundry speech synthesis |
| Speech synthesis | GitHub Models | ✅ | Shares Azure AI Inference implementation path |
| Speech synthesis | Groq | ✅ | OpenAI-compatible speech path |
| Audio translation | OpenAI | ✅ | `audio/translations` |
| Audio translation | Azure OpenAI | ✅ | Azure audio translation |
| Audio translation | Azure AI Inference | ✅ | Foundry audio translation |
| Audio translation | GitHub Models | ✅ | Shares Azure AI Inference implementation path |
| Audio translation | Groq | ✅ | OpenAI-compatible translation path |
| 3D generation | Meshy | ✅ | Dedicated 3D provider integration |
| 3D generation | Tripo3D | ✅ | Dedicated 3D provider integration |

## Full Capability Matrix

`Provider ID` matches the exact value used in `target.provider`.

| Provider ID | Chat | Stream | Complete | Embed | Image Gen | Chat Image | Chat Audio | Chat Video | Chat Docs | Transcribe | Speech | Translate | 3D |
|-------------|------|--------|----------|-------|-----------|------------|------------|------------|-----------|------------|--------|-----------|----|
| `302ai` | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| `ai21` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — |
| `aibadgr` | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| `anthropic` | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ | — | — | — | — |
| `anyscale` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `azure-ai` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| `azure-openai` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| `bedrock` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `bytez` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `cerebras` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `cohere` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `cometapi` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `cortex` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `dashscope` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `databricks` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `deepbricks` | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| `deepinfra` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `deepseek` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `featherless-ai` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `fireworks-ai` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| `github` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| `google` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `groq` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| `huggingface` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `hyperbolic` | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| `inference-net` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `iointelligence` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `jina` | — | — | — | ✅ | — | — | — | — | — | — | — | — | — |
| `kluster-ai` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `krutrim` | ✅ | — | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `lambda` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `latitude` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `lemonfox-ai` | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| `lepton` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| `lingyi` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `matterai` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `meshy` | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| `mistral-ai` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `modal` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `monsterapi` | ✅ | — | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `moonshot` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `ncompass` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `nebius` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `nextbit` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `nomic` | — | — | — | ✅ | — | — | — | — | — | — | — | — | — |
| `novita-ai` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `ollama` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `openai` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — |
| `openrouter` | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `oracle` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `ovhcloud` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `palm` | ✅ | — | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `perplexity-ai` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `predibase` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `recraft-ai` | — | — | — | — | ✅ | — | — | — | — | — | — | — | — |
| `reka-ai` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `replicate` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `sagemaker` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `sambanova` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `segmind` | — | — | — | — | ✅ | — | — | — | — | — | — | — | — |
| `siliconflow` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| `stability-ai` | — | — | — | — | ✅ | — | — | — | — | — | — | — | — |
| `together-ai` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `tripo3d` | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| `triton` | — | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| `upstage` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `vertex-ai` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `voyage` | — | — | — | ✅ | — | — | — | — | — | — | — | — | — |
| `workers-ai` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| `x-ai` | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `z-ai` | ✅ | ✅ | — | — | — | ✅ | ✅ | — | ✅ | — | — | — | — |
| `zhipu` | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | — | ✅ | — | — | — | — |

## Notes

| Topic | Detail |
|-------|--------|
| `github` | Implemented through the Azure AI Inference provider path, so its capability surface matches that integration in current code. |
| Streaming column | Marks runtime streaming support in Priorai routing, not only explicit `stream-chatComplete` registry entries. Providers such as `azure-openai` stream through the OpenAI-compatible stream path. |
| Chat multimodal columns | `Chat Image`, `Chat Audio`, `Chat Video`, and `Chat Docs` mean Priorai can route that input kind through `chat.completions.create()` for at least one supported source form. They are separate from dedicated APIs like `images.generate()` or `audio.transcribe()`. |
| OpenAI Responses audio | `openai` and `azure-openai` support chat `input_audio`, but the current Responses adapter rejects `input_audio` on `responses.create()`. |
| Azure Responses image shape | `azure-openai` `responses.create()` accepts `input_image.image_url` as URL or data URL and rejects `input_image.file_id`. |
| Realtime scope | Priorai currently exposes OpenAI Realtime bootstrap HTTP surfaces in the SDK, but not a provider-agnostic transport runtime. |
| Image generation count | Includes `segmind`, which uses model-path style routing instead of an explicit `imageGenerate` switch entry. |
| 3D providers | `meshy` and `tripo3d` are dedicated 3D integrations rather than chat-style providers. |
| Source of truth | This document reflects the repository state in `src/providers/` and should be preferred over older README counts or historical notes. |
