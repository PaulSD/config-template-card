import { LovelaceCardConfig, EntitiesCardEntityConfig, LovelaceElementConfigBase } from 'custom-card-helpers';
import { HomeAssistant, CurrentUser } from 'custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';

interface StyleMixin {
  style?: Record<string, string>;
}

export interface ConfigTemplateConfig {
  type: string;
  entities?: string[];
  variables?: Record<string, any> | any[];
  card?: LovelaceCardConfig & StyleMixin;
  row?: EntitiesCardEntityConfig & StyleMixin;
  element?: LovelaceElementConfigBase & StyleMixin;
  style?: Record<string, string>;
}

export interface ConfigTemplateVars {
  hass?: HomeAssistant;
  states?: HassEntities;
  user?: CurrentUser;
  vars: Record<string, any> & any[];
  _evalInit: string;
}
