import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { Config, SVarMgr, VarMgr, Vars, ObjMap } from './types';
import { VERSION } from './version';
import { assertNotNull, isString, isPromise, somePromise } from './util';

console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {

  // External interactions:
  //
  // Lit updates are triggered by changing any "property" or "state" variables, or by explicitly
  // calling `this.requestUpdate()`.
  //
  // After a Lit update has been triggered, Lit will call `shouldUpdate(changedProps)`, and if that
  // returns `true` then Lit will call `render()`.
  // When performing async Lit rendering using `until()`, Lit should not begin a new update until
  // the prior async update has completed.  However, this code is designed to be able to handle
  // parallel updates anyway.
  //
  // When HA state changes, HA will set `hass`.
  // When HA config changes, HA will call `setConfig(config)`.
  // When the global (dashboard wide) 'config_template_card_*' config changes, nothing happens;
  // Users should reload their browser after changing the global config.
  //
  // After construction, the following will be triggered in an unspecified order:
  // * Lit will trigger an update
  // * HA will call `setConfig(config)` (which will trigger another update)
  // * HA will set `hass` (which will trigger another update)
  //
  // It is not clear whether the global config is available at construction time, and it is only
  // used here in combination with the local config, so we don't retrieve it until `setConfig()` is
  // called.

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: Config;
  @state() private _helpers?: any;

  private _globalConfig: { svars: any, vars: any } = { svars: undefined, vars: undefined };
  private _svarMgr?: SVarMgr;
  private _initialized = false;
  private _tmpVarMgr?: VarMgr;

  public constructor() {
    super();
    void this.loadCardHelpers();
  }

  public setConfig(config?: Config): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (!config.card && !config.row && !config.element) {
      throw new Error('No card or row or element defined');
    }
    if ([config.card, config.row, config.element].filter(v => v).length > 1) {
      throw new Error('Only one of card/row/element can be defined');
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
    if (!config.element && config.style) {
      throw new Error('style can only be used with element');
    }
    this._config = config;

    this._globalConfig = this.getLovelaceConfig();

    // Force re-evaluation of staticVariables
    this._svarMgr = undefined;
    this._initialized = false;
    this._initialize();
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
      svars: panel?.lovelace?.config?.config_template_card_staticVars,
      vars: panel?.lovelace?.config?.config_template_card_vars,
    };
  }

  public getCardSize(): number | Promise<number> {
    if (this.shadowRoot) {
      // eslint improperly parses this assertion, but typescript handles it properly
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard | null;
      if (element) {
        Promise.resolve(computeCardSize(element)).then((size) => {
          console.log('computeCardSize is ' + String(size));
        }, () => undefined);
        return computeCardSize(element);
      }
    }
    return 1;
  }

  private _initialize(): boolean {
    // _initSVars() requires hass and _config
    if (!this.hass || !this._config) { return false; }

    // shouldUpdate() requires _svarMgr to be settled
    if (!this._svarMgr) {
      this._svarMgr = this._evaluateVars(true);
      if (this._svarMgr._svarsPromise) {
        void this._svarMgr._svarsPromise.then((v) => {
          // Explicitly trigger an update after svars has settled
          this.requestUpdate();
          return v;
        });
        return false;
      }
    } else {
      if (this._svarMgr._svarsPromise) { return false; }
    }

    // render() requires hass, _config, and _helpers
    if (!this._helpers) { return false; }

    this._initialized = true;
    return true;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) { return this._initialize(); }
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()
    assertNotNull(this.hass);  // TypeScript can't detect the gate in _initialize()

    if (changedProps.has('_config')) { return true; }

    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (oldHass) {
      if (!this._config.entities) { return false; }
      const varMgr = this._evaluateVars(false);
      // Cache the evaluated variables to avoid requiring render() to evaluate them again
      this._tmpVarMgr = varMgr;
      const entities = this._evaluateStructure(varMgr, this._config.entities, 'immediate');
      for (const entity of entities) {
        if (isPromise(entity)) {
          console.warn("Ignoring asynchronous function in 'entities'. Asynchronous functions are not permitted in config-template-card 'entities'.");
          continue;
        }
        if (!isString(entity)) {
          console.warn("Ignoring non-string value in 'entities'. Only string values are permitted in config-template-card 'entities'.");
          continue;
        }
        if (oldHass.states[entity] !== this.hass.states[entity]) {
          return true;
        }
      }
      return false;
    }

    // If anything else changed then re-render
    return true;
  }

  protected render(): TemplateResult {
    if (!this._initialized) { return html``; }  // Shouldn't happen

    let varMgr = this._tmpVarMgr;
    this._tmpVarMgr = undefined;
    if (!varMgr) { varMgr = this._evaluateVars(false); }  // Shouldn't happen

    return html`${until(this._getElement(varMgr))}`;
  }

  private async _getElement(varMgr: VarMgr): Promise<TemplateResult> {
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()

    if (varMgr._varsPromise) { await varMgr._varsPromise; }

    let configSection = (this._config.card ?? this._config.row ?? this._config.element);
    configSection = await this._evaluateStructure(varMgr, configSection);

    const element = this._config.card
      ? this._helpers.createCardElement(configSection)
      : this._config.row
        ? this._helpers.createRowElement(configSection)
        : this._helpers.createHuiElement(configSection);
    element.hass = this.hass;

    if (this._config.element) {
      if (this._config.style) {
        let style = this._config.style;
        style = await this._evaluateStructure(varMgr, style);
        Object.keys(style).forEach((prop) => {
          this.style.setProperty(prop, style[prop]);
        });
      }
      if (configSection?.style) {
        Object.keys(configSection.style).forEach((prop) => {
          assertNotNull(configSection.style);  // TypeScript can't detect the enclosing if()
          element.style.setProperty(prop, configSection.style[prop]);
        });
      }
    }

    return html`<div id="card">${element}</div>`;
  }

  private _evaluateVars(doStatic: false): VarMgr;
  private _evaluateVars(doStatic: true): SVarMgr;
  private _evaluateVars(doStatic) {
    assertNotNull(this.hass);  // TypeScript can't detect the gate in _initialize()
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()

    let globalVars: Vars | undefined;
    let localVars: Vars | undefined;
    if (doStatic) {
      globalVars = this._globalConfig.svars;
      localVars = this._config.staticVariables;
    } else {
      globalVars = this._globalConfig.vars;
      localVars = this._config.variables;
    }

    const arrayVars: any[] = [];
    const namedVars: ObjMap = {};
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

    const varMgr: VarMgr = {
      hass: this.hass, states: this.hass.states, user: this.hass.user,
      svars: this._svarMgr?.svars ?? [], _evalInitSVars: this._svarMgr?._evalInitSVars ?? '',
      vars: [], _evalInitVars: '',
    };
    const immediateVars: Vars = (doStatic ? varMgr.svars : varMgr.vars);
    const initKey = (doStatic ? '_evalInitSVars' : '_evalInitVars');
    const initRef = (doStatic ? 'svars' : 'vars');

    const arrayVars2: any[] = [];
    for (let v of arrayVars) {
      if (isString(v)) {
        v = this._evaluateTemplate(varMgr, v, true);
        immediateVars.push(v);
        arrayVars2.push(v);
      } else {
        v = this._evaluateStructure(varMgr, v, 'both');
        immediateVars.push(v.immediate);
        arrayVars2.push(v.promise);
      }
    }
    const namedVars2: ObjMap = {};
    for (const varName in namedVars) {
      let v = namedVars[varName];
      if (isString(v)) {
        v = this._evaluateTemplate(varMgr, v, true);
        immediateVars[varName] = v;
        namedVars2[varName] = v;
      }
      else {
        v = this._evaluateStructure(varMgr, v, 'both');
        immediateVars[varName] = v.immediate;
        namedVars2[varName] = v.promise;
      }
      // Note that if `staticVariables` and `variables` both contain a variable with the same name
      // then `_evalInitSVars + _evalInitVars` will end up defining the variable twice.  This
      // shouldn't be a problem, since the second definition will simply override the first.
      // However, if browsers/JavaScript are changed so that re-defining a variable causes a warning
      // or error then we may need to explicitly remove duplicates from `_evalInitSVars`.
      varMgr[initKey] += `var ${varName} = ${initRef}['${varName}'];\n`;
    }

    let promiseArrayVars: Promise<any[]> | undefined;
    if (somePromise(arrayVars2)) {
      promiseArrayVars = Promise.all(arrayVars2.map((v) => Promise.resolve(v)));
    }
    let promiseNamedVars: Promise<ObjMap> | undefined;
    if (somePromise(Object.entries(namedVars2).map(([_k, v], _i) => v))) {
      promiseNamedVars = Promise.all(Object.entries(namedVars2).map(([k, v], _i) =>
        Promise.resolve(v).then((v) => [k, v])
      )).then((a) => Object.fromEntries(a));
    }
    let promise: Promise<any> | undefined;
    if (isPromise(promiseArrayVars) || isPromise(promiseNamedVars)) {
      promise = Promise.all([promiseArrayVars, promiseNamedVars].map((v) => Promise.resolve(v)))
      .then(([pav, pnv]) => Object.assign(pav as any[], pnv as ObjMap));
    }

    if (doStatic) {
      const svarMgr: SVarMgr = {
        svars: immediateVars, _evalInitSVars: varMgr._evalInitSVars,
      };
      if (promise) {
        svarMgr._svarsPromise = promise.then((v) => {
          svarMgr.svars = v;
          svarMgr._svarsPromise = undefined;
          return v;
        });
      }
      return svarMgr;
    } else {
      if (promise) {
        varMgr._varsPromise = promise.then((v) => {
          varMgr.vars = v;
          varMgr._varsPromise = undefined;
          return v;
        });
      }
      return varMgr;
    }
  }

  // Return value is based on `mode`:
  // * 'promise' will return either a Promise (that will settle when all Promises returned by
  //   templates have settled), or a non-Promise (if no nested templates return a Promise).
  // * 'immediate' will return a non-Promise, potentially with nested Promise values.
  // * 'both' will return both of the above as `{ promise: p, immediate: i }`.
  private _evaluateStructure(varMgr: VarMgr, struct: any, mode = 'promise'): any {
    let ret;

    if (struct instanceof Array) {
      ret = struct.map((v, _i) =>
        this._evaluateStructure(varMgr, v, mode)
      );
      if (mode != 'immediate') {
        let promiseTmp: any[], immediate: any[] = [], promise: any[] | Promise<any[]>;
        if (mode == 'both') { immediate = ret.map((v) => v.immediate); }
        promise = promiseTmp = (mode == 'both' ? ret.map((v) => v.promise) : ret);
        if (somePromise(promiseTmp)) {
          promise = Promise.all(promiseTmp.map((v) => Promise.resolve(v)));
        }
        ret = (mode == 'both' ? { promise: promise, immediate: immediate } : promise);
      }

    } else if (typeof struct === 'object') {
      const tmp = Object.entries(struct as ObjMap).map(([k, v], _i) =>
        [k, this._evaluateStructure(varMgr, v, mode)]
      );
      let immediateTmp: any[], promiseTmp: any[];
      let immediate: ObjMap = {}, promise: ObjMap | Promise<ObjMap> = {};
      if (mode != 'promise') {
        immediateTmp = (mode == 'both' ? tmp.map(([k, v], _i) => [k, v.immediate]) : tmp);
        immediate = Object.fromEntries(immediateTmp);
        ret = immediate;
      }
      if (mode != 'immediate') {
        promiseTmp = (mode == 'both' ? tmp.map(([k, v], _i) => [k, v.promise]) : tmp);
        if (somePromise(promiseTmp.map(([_k, v], _i) => v))) {
          promise = Promise.all(promiseTmp.map(([k, v], _i) =>
            Promise.resolve(v).then((v) => [k, v])
          )).then((a) => Object.fromEntries(a));
        } else {
          promise = Object.fromEntries(promiseTmp);
        }
        ret = promise;
      }
      if (mode == 'both') { ret = { promise: promise, immediate: immediate }; }

    } else if (isString(struct)) {
      ret = this._evaluateTemplate(varMgr, struct);
      if (mode == 'both') { ret = { promise: ret, immediate: ret }; }

    } else {
      ret = structuredClone(struct);
      if (mode == 'both') { ret = { promise: ret, immediate: ret }; };
    }

    return ret;
  }

  private _evaluateTemplate(varMgr: VarMgr, template: string, withoutDelim = false): any {
    if (template.startsWith('$! ')) {
      return template.substring(3, template.length);
    }

    if (template.startsWith('${') && template.endsWith('}')) {
      // The entire property is a template, return eval's result directly
      // to preserve types other than string (eg. numbers)
      return this._evalWithVars(varMgr, template.substring(2, template.length - 1));
    }

    const matches = template.match(/\${[^}]+}/g);
    if (matches) {
      const repls = matches.map((m, _i) => {
        return [m, this._evalWithVars(varMgr, m.substring(2, m.length - 1), '<error>')]
      });
      if (somePromise(repls.map(([_m, r], _i) => r))) {
        return Promise.all(repls.map(([m, p]) =>
          Promise.resolve(p).then((r) => [m, r])
        )).then((a) => {
          let t = template;
          a.forEach(([m, r]) => t = t.replace(m as string, String(r)));
          return t;
        });
      } else {
        repls.forEach(([m, r]) => template = template.replace(m as string, String(r)));
        return template;
      }
    }

    if (withoutDelim) {
      return this._evalWithVars(varMgr, template);
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

  private _evalWithVars(varMgr: VarMgr, template: string, exceptRet: any = null): any {
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
      globalThis._varMgr = varMgr;
      globalThis.hass = this.hass;
      const initBase = this._evalInitBase;
      const initSVars = varMgr._evalInitSVars;
      const initVars = varMgr._evalInitVars;
      const indirectEval = eval;

      const ret = indirectEval(initBase + initSVars + initVars + template);

      if (isPromise(ret)) {
        return ret.catch((e: unknown) => {
          console.error('Template error:', e);
          return exceptRet;
        });
      }
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
