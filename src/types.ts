import { LovelaceCardConfig, EntitiesCardEntityConfig, LovelaceElementConfigBase } from 'custom-card-helpers';

interface StyleMixin {
  style?: Record<string, string>;
}

export interface ConfigTemplateConfig {
  type: string;
  entities: string[];
  variables?: Record<string, any> | any[];
  card?: LovelaceCardConfig & StyleMixin;
  row?: EntitiesCardEntityConfig & StyleMixin;
  element?: LovelaceElementConfigBase & StyleMixin;
  style?: Record<string, string>;
}
