import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { ConfigTemplateConfig, ConfigTemplateVarMgr } from './types';
import { VERSION } from './version';
import { isString } from './util';

console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: ConfigTemplateConfig;
  private _varMgr: ConfigTemplateVarMgr = {};
  @state() private _helpers?: any;
  private _initialized = false;

  public setConfig(config?: ConfigTemplateConfig): void {
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

    void this.loadCardHelpers();
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private getLovelacePanel(): any {
    const ha = document.querySelector('home-assistant');
    if (ha?.shadowRoot) {
      const haMain = ha.shadowRoot.querySelector('home-assistant-main');
      if (haMain?.shadowRoot) {
        return haMain.shadowRoot.querySelector('ha-panel-lovelace');
      }
    }
    return null;
  }

  private getLovelaceConfig(): any {
    const panel = this.getLovelacePanel();

    if (panel?.lovelace?.config?.config_template_card_vars) {
      return panel.lovelace.config.config_template_card_vars;
    }
    return {};
  }

  public getCardSize(): number | Promise<number> {
    if (this.shadowRoot) {
      // eslint detects this assertion as unnecessary, but typescript requires it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard | null;
      if (element) {
        Promise.resolve(computeCardSize(element)).then((size) => {
          console.log('computeCardSize is ' + size.toString());
        }, () => undefined);
        return computeCardSize(element);
      }
    }
    return 1;
  }

  private _initialize(): boolean {
    if (!this.hass || !this._config || !this._helpers) { return false; }
    this._initialized = true;
    return true;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized && !this._initialize()) {
      return true;
    }
    // TypeScript doesn't detect the check in _initialize()
    if (!this._config) { return true; }

    if (changedProps.has('_config')) {
      return true;
    }

    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (oldHass) {
      this._evaluateVars();
      for (const entity of this._evaluateStructure(structuredClone(this._config.entities))) {
        if (this.hass && oldHass.states[entity] !== this.hass.states[entity]) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  protected render(): TemplateResult {
    if (!this._initialized && !this._initialize()) {
      return html``;
    }
    // TypeScript doesn't detect the check in _initialize()
    if (!this._config) { return html``; }

    let configSection = this._config.card
      ? structuredClone(this._config.card)
      : this._config.row
        ? structuredClone(this._config.row)
        : structuredClone(this._config.element);

    let style = this._config.style ? structuredClone(this._config.style) : {};

    // render() is usually called shortly after shouldUpdate(), in which case we probably don't need
    // to re-evaluate variables.
    if (!this._varMgr.vars) { this._evaluateVars(); }

    configSection = this._evaluateStructure(configSection);
    style = this._evaluateStructure(style);

    // In case the next call to render() is not preceded by a call to shouldUpdate(), force the next
    // render() call to re-evaluate variables.
    this._varMgr.vars = undefined;

    const element = this._config.card
      ? this._helpers.createCardElement(configSection)
      : this._config.row
        ? this._helpers.createRowElement(configSection)
        : this._helpers.createHuiElement(configSection);
    element.hass = this.hass;

    if (this._config.element) {
      Object.keys(style).forEach((prop) => {
        this.style.setProperty(prop, style[prop]);
      });
      if (configSection?.style) {
        Object.keys(configSection.style).forEach((prop) => {
          if (configSection.style) {  // TypeScript requires a redundant check here, not sure why
            element.style.setProperty(prop, configSection.style[prop]);
          }
        });
      }
    }

    return html`<div id="card">${element}</div>`;
  }

  private _evaluateVars(): void {
    const vars: Record<string, any> & any[] = [];
    let namedVars: Record<string, any> = {};
    let arrayVars: any[] = [];

    Object.assign(this._varMgr, {
      hass: this.hass, states: this.hass?.states, user: this.hass?.user, vars: vars,
    });
    // TypeScript can't detect this if it is set in Object.assign()
    this._varMgr._evalInitVars = '';

    if (this._config?.variables) {
      if (Array.isArray(this._config.variables)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...this._config.variables);
      } else {
        Object.assign(namedVars, this._config.variables);
      }
    }

    const localVars = this.getLovelaceConfig();
    if (localVars) {
      if (Array.isArray(localVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...localVars);
      } else {
        Object.assign(namedVars, localVars);
      }
    }

    arrayVars = structuredClone(arrayVars);
    for (let v of arrayVars) {
      if (isString(v) && !v.includes('${')) { v = this._evalWithVars(v); }
      else { v = this._evaluateStructure(v); }
      vars.push(v);
    }

    namedVars = structuredClone(namedVars);
    for (const varName in namedVars) {
      let v = namedVars[varName];
      if (isString(v) && !v.includes('${')) { v = this._evalWithVars(v); }
      else { v = this._evaluateStructure(v); }
      vars[varName] = v;
      this._varMgr._evalInitVars += `var ${varName} = vars['${varName}'];\n`;
    }
  }

  private _evaluateStructure(struct: any): any {
    if (struct instanceof Array) {
      for (let i = 0; i < struct.length; ++i) {
        const value = struct[i];
        struct[i] = this._evaluateStructure(value);
      }
    } else if (typeof struct === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      Object.entries(struct).forEach(entry => {
        const key = entry[0];
        const value = entry[1];
        struct[key] = this._evaluateStructure(value);
      });
    } else if (isString(struct) && struct.includes('${')) {
      return this._evaluateTemplate(struct);
    }
    return struct;
  }

  private _evaluateTemplate(template: string): any {
    if (template.startsWith('${') && template.endsWith('}')) {
      // The entire property is a template, return eval's result directly
      // to preserve types other than string (eg. numbers)
      return this._evalWithVars(template.substring(2, template.length - 1));
    }

    /\${[^}]+}/.exec(template)?.forEach(m => {
      const repl = this._evalWithVars(m.substring(2, m.length - 1), '<error>').toString() as string;
      template = template.replace(m, repl);
    });
    return template;
  }

  private _evalInitBase = (
    "'use strict'; undefined;\n" +
    'var hass = globalThis._varMgr.hass;\n' +
    'var states = globalThis._varMgr.states;\n' +
    'var user = globalThis._varMgr.user;\n' +
    'var vars = globalThis._varMgr.vars;\n' +
  '');

  private _evalWithVars(template: string, exceptRet: any = null): any {
    // "direct" eval() is considered insecure and generates warnings, so use "indirect" eval().
    //
    // "indirect" eval() sets `this` to `globalThis`/`window`, and does not support changing `this`
    // except by calling a function or class within the eval() (which would break the implicit
    // return semantics that we rely on for most use cases).
    //
    // Variables can only be passed between this code and "indirect" eval() code via the global
    // scope (`globalThis`).
    //
    // For backward compatibility, `this.hass` must be available to evaluated templates.
    //
    // "indirect" eval() runs in non-strict mode by default, which causes new local variables to be
    // added to `this` and pollute the global scope.  Explicitly switching to strict mode within the
    // eval() disables adding local variables to `this` and avoids polluting the global scope.
    //
    // In addition to switching to strict mode, the `'use strict';` statement also sets the implicit
    // return value to 'use strict', which isn't what we want if the template is empty.  Therefore
    // we explicitly follow it with `undefined;` to reset the implicit return value.

    // In case there are conflicting global variables
    const origVarMgr = globalThis._varMgr;
    const origHass = globalThis.hass;

    try {
      globalThis._varMgr = this._varMgr;
      globalThis.hass = this.hass;
      const initBase = this._evalInitBase;
      const initVars = (this._varMgr._evalInitVars ?? '');
      const indirectEval = eval;

      const ret = indirectEval(initBase + initVars + template);

      return ret;
    } catch(e) {
      console.error('Template error:', e);
      return exceptRet;
    } finally {
      if (origVarMgr) { globalThis._varMgr = origVarMgr; } else { delete globalThis._varMgr; }
      if (origHass) { globalThis.hass = origHass; } else { delete globalThis.hass; }
    }
  }
}
