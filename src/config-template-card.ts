import { LitElement, html, TemplateResult, PropertyValues } from 'lit-element';
import { customElement, property, state } from 'lit-element/decorators.js';
import deepClone from 'deep-clone-simple';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { ConfigTemplateConfig } from './types';
import { CARD_VERSION } from './const';

/* eslint no-console: 0 */
console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${CARD_VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: ConfigTemplateConfig;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  @state() private _helpers?: any;
  private _initialized = false;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    if (!config.card && !config.row && !config.element) {
      throw new Error('No card or row or element defined');
    }

    if (config.card && !config.card.type) {
      throw new Error('No card type defined');
    }

    if (config.card && config.card.type === 'picture-elements') {
      console.warn(
        'WARNING: config-template-card should not be used with the picture-elements card itself. Instead use it as one of the elements. Check the README for details',
      );
    }

    if (config.element && !config.element.type) {
      throw new Error('No element type defined');
    }

    if (!config.entities) {
      throw new Error('No entities defined');
    }

    this._config = config;

    this.loadCardHelpers();
  }

  private getLovelacePanel() {
    const ha = document.querySelector('home-assistant');

    if (ha && ha.shadowRoot) {
      const haMain = ha.shadowRoot.querySelector('home-assistant-main');

      if (haMain && haMain.shadowRoot) {
        return haMain.shadowRoot.querySelector('ha-panel-lovelace');
      }
    }

    return null;
  }

  private getLovelaceConfig() {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const panel = this.getLovelacePanel() as any;

    if (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.config_template_card_vars) {
      return panel.lovelace.config.config_template_card_vars;
    }

    return {};
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    if (changedProps.has('_config')) {
      return true;
    }

    if (this._config) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

      if (oldHass) {
        for (const entity of this._evaluateConfig(this._config.entities)) {
          if (Boolean(this.hass && oldHass.states[entity] !== this.hass.states[entity])) {
            return true;
          }
        }
        return false;
      }
    }

    return true;
  }

  public getCardSize(): number | Promise<number> {
    if (this.shadowRoot) {
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard;
      if (element) {
        console.log('computeCardSize is ' + computeCardSize(element));
        return computeCardSize(element);
      }
    }

    return 1;
  }

  protected render(): TemplateResult | void {
    if (
      !this._config ||
      !this.hass ||
      !this._helpers ||
      (!this._config.card && !this._config.row && !this._config.element)
    ) {
      return html``;
    }

    let config = this._config.card
      ? deepClone(this._config.card)
      : this._config.row
        ? deepClone(this._config.row)
        : deepClone(this._config.element);

    let style = this._config.style ? deepClone(this._config.style) : {};

    config = this._evaluateConfig(config);
    if (style) {
      style = this._evaluateConfig(style);
    }

    const element = this._config.card
      ? this._helpers.createCardElement(config)
      : this._config.row
        ? this._helpers.createRowElement(config)
        : this._helpers.createHuiElement(config);
    element.hass = this.hass;

    if (this._config.element) {
      if (style) {
        Object.keys(style).forEach((prop) => {
          this.style.setProperty(prop, style[prop]);
        });
      }
      if (config.style) {
        Object.keys(config.style).forEach((prop) => {
          element.style.setProperty(prop, config.style[prop]);
        });
      }
    }

    return html`<div id="card">${element}</div>`;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    this._helpers = await (window as any).loadCardHelpers();
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private _evaluateConfig(config: any): any {
    if (config instanceof Array) {
      for (let i = 0; i < config.length; ++i) {
        const value = config[i];
        config[i] = this._evaluateConfig(value);
      }
    } else if (typeof config === 'object') {
      Object.entries(config).forEach(entry => {
        const key = entry[0];
        const value = entry[1];
        config[key] = this._evaluateConfig(value);
      });
    } else if (typeof config === 'string' && config.includes('${')) {
      return _evaluateTemplate(config);
    }

    return config;
  }

  private _evaluateTemplate(template: string): string {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const user = this.hass ? this.hass.user : undefined;
    const states = this.hass ? this.hass.states : undefined;
    const vars: any[] = [];
    const namedVars: { [key: string]: any } = {};
    const arrayVars: string[] = [];

    if (this._config) {
      if (Array.isArray(this._config.variables)) {
        arrayVars.push(...this._config.variables);
      } else {
        Object.assign(namedVars, this._config.variables);
      }
    }

    const localVars = this.getLovelaceConfig();

    if (localVars) {
      if (Array.isArray(localVars)) {
        arrayVars.push(...localVars);
      } else {
        Object.assign(namedVars, localVars);
      }
    }

    for (const v in arrayVars) {
      const newV = eval(arrayVars[v]);
      vars.push(newV);
    }

    for (const varName in namedVars) {
      const newV = eval(namedVars[varName]);
      vars[varName] = newV;
      eval(`var ${varName} = newV;`);
    }

    if (template.startsWith("${") && template.endsWith("}")) {
      // The entire property is a template, return eval's result directly
      // to preserve types other than string (eg. numbers)
      return eval(template.substring(2, template.length - 1));
    }

    template.match(/\${[^}]+}/g).forEach(m => {
      const repl = eval(m.substring(2, m.length - 1));
      template = template.replace(m, repl);
    });
    return template;
  }
}
