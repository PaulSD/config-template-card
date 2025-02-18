import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { Config as ConfigType, VarMgr as VarMgrType, Vars as VarsType } from './types';
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
  @state() private _config?: ConfigType;
  private _varMgr: VarMgrType = {};
  @state() private _helpers?: any;
  private _initialized = false;

  public setConfig(config?: ConfigType): void {
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
    return {
      vars: panel?.lovelace?.config?.config_template_card_vars,
      svars: panel?.lovelace?.config?.config_template_card_staticVars,
    };
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

  private _evaluateVars(doStatic = false, globalConfig: any = undefined): void {
    const vars: VarsType = [];
    let namedVars: Record<string, any> = {};
    let arrayVars: any[] = [];
    let init = '', initRef: string;

    let globalVars: VarsType | undefined;
    let localVars: VarsType | undefined;
    if (!globalConfig) { globalConfig = this.getLovelaceConfig(); }
    if (!doStatic) {
      Object.assign(this._varMgr, {
        hass: this.hass, states: this.hass?.states, user: this.hass?.user, vars: vars,
      });
      if (!this._varMgr.svars) {
        this._evaluateVars(true, globalConfig);
      }
      globalVars = globalConfig.vars;
      localVars = this._config?.variables;
      initRef = 'vars';
    } else {
      // This assumes that _evaluateVars(true) is only called by _evaluateVars(false), so we can
      // assume that _varMgr is already initialized.
      globalVars = globalConfig.svars;
      localVars = this._config?.staticVariables;
      initRef = 'svars';
    }

    if (globalVars) {
      if (Array.isArray(globalVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...globalVars);
      } else {
        Object.assign(namedVars, globalVars);
      }
    }

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
      if (isString(v)) { v = this._evaluateTemplate(v, true); }
      else { v = this._evaluateStructure(v); }
      vars.push(v);
    }

    namedVars = structuredClone(namedVars);
    for (const varName in namedVars) {
      let v = namedVars[varName];
      if (isString(v)) { v = this._evaluateTemplate(v, true); }
      else { v = this._evaluateStructure(v); }
      vars[varName] = v;
      init += `var ${varName} = ${initRef}['${varName}'];\n`;
      if (!doStatic) { this._varMgr._evalInitVars = init; }
      else { this._varMgr._evalInitSVars = init; }
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
    } else if (isString(struct)) {
      return this._evaluateTemplate(struct);
    }
    return struct;
  }

  private _evaluateTemplate(template: string, withoutDelim = false): any {
    if (template.startsWith('$! ')) {
      return template.substring(3, template.length);
    }

    if (template.startsWith('${') && template.endsWith('}')) {
      // The entire property is a template, return eval's result directly
      // to preserve types other than string (eg. numbers)
      return this._evalWithVars(template.substring(2, template.length - 1));
    }

    const matches = template.match(/\${[^}]+}/g);
    if (matches) {
      matches.forEach(m => {
        const repl = this._evalWithVars(m.substring(2, m.length - 1), '<error>').toString() as string;
        template = template.replace(m, repl);
      });
      return template;
    }

    if (withoutDelim) {
      return this._evalWithVars(template);
    }

    return template;
  }

  private _evalInitBase = (
    "'use strict'; undefined;\n" +
    'var hass = globalThis._varMgr.hass;\n' +
    'var states = globalThis._varMgr.states;\n' +
    'var user = globalThis._varMgr.user;\n' +
    'var svars = globalThis._varMgr.svars;\n' +
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
      const initSVars = (this._varMgr._evalInitSVars ?? '');
      const initVars = (this._varMgr._evalInitVars ?? '');
      const indirectEval = eval;

      const ret = indirectEval(initBase + initSVars + initVars + template);

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
