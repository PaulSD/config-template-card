import { LovelaceCardConfig, EntitiesCardEntityConfig, LovelaceElementConfigBase } from 'custom-card-helpers';
import { HomeAssistant, CurrentUser } from 'custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';

export type Vars = Record<string, any> | any[];

interface StyleMixin {
  style?: Record<string, string>;
}

export interface Config {
  type: string;
  entities?: string[];
  variables?: Vars;
  staticVariables?: Vars;
  card?: LovelaceCardConfig & StyleMixin;
  row?: EntitiesCardEntityConfig & StyleMixin;
  element?: LovelaceElementConfigBase & StyleMixin;
  style?: Record<string, string>;
}

export interface VarMgr {
  hass?: HomeAssistant;
  states?: HassEntities;
  user?: CurrentUser;
  vars?: Vars;
  _evalInitVars?: string;
  svars?: Vars;
  _evalInitSVars?: string;
}
