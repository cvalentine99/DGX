/**
 * Demo Data Index
 * 
 * Central export for all demo/mock data.
 * Import from this file to access demo data throughout the application.
 * 
 * Usage:
 *   import { DEMO_MODE, DEMO_DATASETS } from '@/demo';
 *   
 *   const datasets = DEMO_MODE ? DEMO_DATASETS : apiData;
 */

// Configuration
export { DEMO_MODE, getDemoOrProduction, getDemoDataOrEmpty, mergeDemoData } from './config';

// Datasets
export {
  DEMO_DATASETS,
  DEMO_QUALITY_METRICS,
  DEMO_PREPROCESSING_STAGES,
  type DemoDataset,
  type DemoQualityMetrics,
} from './datasets';

// Environment
export {
  DEMO_TOPOLOGY_DATA,
  DEMO_SOFTWARE_STACK,
  DEMO_MODEL_ARTIFACTS,
  DEMO_CONTAINER_IMAGES,
  type DemoTopologyNode,
  type DemoTopologyLink,
  type DemoSoftwareItem,
  type DemoModelArtifact,
  type DemoContainerImage,
} from './environment';

// Training
export {
  DEMO_TRAINING_RECIPES,
  DEMO_MOE_PARAMS,
  DEMO_TRAINING_JOB,
  DEMO_LOSS_HISTORY,
  DEMO_TRAINING_METRICS,
  type DemoTrainingRecipe,
  type DemoMoEParams,
  type DemoTrainingJob,
  type DemoLossPoint,
  type DemoTrainingMetric,
} from './training';

// Docker
export {
  DEMO_NVIDIA_WORKSHOP_TEMPLATES,
  DEMO_RUNNING_CONTAINERS,
  type DemoWorkshopTemplate,
  type DemoRunningContainer,
} from './docker';

// Interaction
export {
  DEMO_SYSTEM_PROMPTS,
  DEMO_DEFAULT_CONFIG,
  DEMO_CHAT_HISTORY,
  type DemoSystemPrompt,
  type DemoChatConfig,
  type DemoChatMessage,
} from './interaction';
