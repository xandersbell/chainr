// Provider registry — statically imports all provider configs
// Aligned with Portkey's src/providers/index.ts structure
import AI302Config from './302ai';
import AI21Config from './ai21';
import AIBadgrConfig from './aibadgr';
import AnthropicConfig from './anthropic';
import AnyscaleConfig from './anyscale';
import {
  AzureAIInferenceAPIConfig,
  GithubModelAPiConfig,
} from './azure-ai-inference';
import AzureOpenAIConfig from './azure-openai';
import BedrockConfig from './bedrock';
import BytezConfig from './bytez';
import { cerebrasProviderAPIConfig } from './cerebras';
import CohereConfig from './cohere';
import CometAPIConfig from './cometapi';
import CortexConfig from './cortex';
import DatabricksConfig from './databricks';
import { DashScopeConfig } from './dashscope';
import DeepbricksConfig from './deepbricks';
import DeepInfraConfig from './deepinfra';
import DeepSeekConfig from './deepseek';
import { FeatherlessAIConfig } from './featherless-ai';
import FireworksAIConfig from './fireworks-ai';
import GoogleConfig from './google';
import VertexConfig from './google-vertex-ai';
import GroqConfig from './groq';
import HuggingfaceConfig from './huggingface';
import HyperbolicConfig from './hyperbolic';
import { InferenceNetProviderConfigs } from './inference-net';
import IOIntelligenceConfig from './iointelligence';
import JinaConfig from './jina';
import KlusterAIConfig from './kluster-ai';
import KrutrimConfig from './krutrim';
import { LambdaProviderConfig } from './lambda';
import LatitudeConfig from './latitude';
import LemonfoxAIConfig from './lemonfox-ai';
import LeptonConfig from './lepton';
import LingyiConfig from './lingyi';
import MatterAIConfig from './matterai';
import MeshyConfig from './meshy';
import MistralAIConfig from './mistral-ai';
import ModalConfig from './modal';
import MonsterAPIConfig from './monsterapi';
import MoonshotConfig from './moonshot';
import NCompassConfig from './ncompass';
import NebiusConfig from './nebius';
import { NextBitConfig } from './nextbit';
import NomicConfig from './nomic';
import NovitaAIConfig from './novita-ai';
import OllamaConfig from './ollama';
import OpenAIConfig from './openai';
import OpenrouterConfig from './openrouter';
import OracleConfig from './oracle';
import OVHcloudConfig from './ovhcloud';
import PalmAIConfig from './palm';
import PerplexityAIConfig from './perplexity-ai';
import PredibaseConfig from './predibase';
import RecraftAIConfig from './recraft-ai';
import RekaAIConfig from './reka-ai';
import ReplicateConfig from './replicate';
import SagemakerConfig from './sagemaker';
import SambaNovaConfig from './sambanova';
import SegmindConfig from './segmind';
import SiliconFlowConfig from './siliconflow';
import StabilityAIConfig from './stability-ai';
import TogetherAIConfig from './together-ai';
import Tripo3DConfig from './tripo3d';
import TritonConfig from './triton';
import { UpstageConfig } from './upstage';
import VoyageConfig from './voyage';
import WorkersAiConfig from './workers-ai';
import XAIConfig from './x-ai';
import ZAIConfig from './z-ai';
import ZhipuConfig from './zhipu';
import type { ProviderConfigs } from './types';

const Providers: { [key: string]: ProviderConfigs } = {
  openai: OpenAIConfig,
  anthropic: AnthropicConfig,
  cohere: CohereConfig,
  'azure-openai': AzureOpenAIConfig,
  'azure-ai': AzureAIInferenceAPIConfig,
  github: GithubModelAPiConfig,
  'vertex-ai': VertexConfig,
  google: GoogleConfig,
  'together-ai': TogetherAIConfig,
  'perplexity-ai': PerplexityAIConfig,
  'mistral-ai': MistralAIConfig,
  groq: GroqConfig,
  deepseek: DeepSeekConfig,
  openrouter: OpenrouterConfig,
  bedrock: BedrockConfig,
  sagemaker: SagemakerConfig,
  nomic: NomicConfig,
  jina: JinaConfig,
  voyage: VoyageConfig,
  // OpenAI-compatible providers
  huggingface: HuggingfaceConfig,
  anyscale: AnyscaleConfig,
  'fireworks-ai': FireworksAIConfig,
  'workers-ai': WorkersAiConfig,
  deepinfra: DeepInfraConfig,
  predibase: PredibaseConfig,
  sambanova: SambaNovaConfig,
  cerebras: cerebrasProviderAPIConfig,
  nebius: NebiusConfig,
  hyperbolic: HyperbolicConfig,
  modal: ModalConfig,
  replicate: ReplicateConfig,
  siliconflow: SiliconFlowConfig,
  'lemonfox-ai': LemonfoxAIConfig,
  deepbricks: DeepbricksConfig,
  'featherless-ai': FeatherlessAIConfig,
  'inference-net': InferenceNetProviderConfigs,
  iointelligence: IOIntelligenceConfig,
  'kluster-ai': KlusterAIConfig,
  matterai: MatterAIConfig,
  nextbit: NextBitConfig,
  'stability-ai': StabilityAIConfig,
  triton: TritonConfig,
  upstage: UpstageConfig,
  aibadgr: AIBadgrConfig,
  cortex: CortexConfig,
  databricks: DatabricksConfig,
  krutrim: KrutrimConfig,
  latitude: LatitudeConfig,
  ncompass: NCompassConfig,
  ollama: OllamaConfig,
  palm: PalmAIConfig,
  'reka-ai': RekaAIConfig,
  dashscope: DashScopeConfig,
  zhipu: ZhipuConfig,
  lingyi: LingyiConfig,
  moonshot: MoonshotConfig,
  'x-ai': XAIConfig,
  lambda: LambdaProviderConfig,
  oracle: OracleConfig,
  ovhcloud: OVHcloudConfig,
  'novita-ai': NovitaAIConfig,
  monsterapi: MonsterAPIConfig,
  lepton: LeptonConfig,
  'recraft-ai': RecraftAIConfig,
  bytez: BytezConfig,
  '302ai': AI302Config,
  ai21: AI21Config,
  cometapi: CometAPIConfig,
  'z-ai': ZAIConfig,
  meshy: MeshyConfig,
  tripo3d: Tripo3DConfig,
  segmind: SegmindConfig,
};

export default Providers;
