# Config Template Card

📝 Template Based Configuration for Lovelace Dashboard Cards

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)
[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)

![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

[![Twitter][twitter]][twitter]
[![Github][github]][github]

## Overview

This [Home Assistant](https://www.home-assistant.io/) [Lovelace Dashboard](https://www.home-assistant.io/dashboards) Card supports the use of Javascript templates to dynamically configure other nested Dashboard Cards.

### Template Language

Note that this Card uses **Javascript** templates. It does NOT support the **Jinja2** templates that are used elsewhere in Home Assistant.

This is because Dashboard Cards are normally rendered entirely in the web browser using Javascript, while Jinja2 templates must be rendered by Python on the Home Assistant server. The use of Javascript for templates enables this Card to render templates in the browser without deviating from the expected design pattern of Dashboard Cards.

For an alternative Card that does support Jinja2 templates, see [lovelace-card-templater](https://github.com/gadgetchnnel/lovelace-card-templater). That Card works by making API calls from the browser to the Home Assistant server to render each template.

### Minimum Home Assistant Version

Home Assistant version 0.110.0 or higher is required as of release 1.2.0 of config-template-card.

### Support

Hey dude! Help me out for a couple of :beers: or a :coffee:!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/zJtVxUAgH)

## Installation

Use [HACS](https://hacs.xyz) or follow this [guide](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

```yaml
resources:
  - url: /local/config-template-card.js
    type: module
```

## Configuration

| Name            | Type        | Requirement  | Description                                       |
| --------------- | ----------- | ------------ | ------------------------------------------------- |
| type            | string      | **Required** | Must be `custom:config-template-card`             |
| entities        | list        | **Optional** | List of entity strings that should be watched for updates. Templates can be used here. |
| staticVariables | list/object | **Optional** | List of variables, which can be templates, that can be used in other templates and indexed using `svars` or by name. These are evaluated only on the first update/render and are preserved without re-evaluation for subsequent updates. |
| variables       | list/object | **Optional** | List of variables, which can be templates, that can be used in other templates and indexed using `vars` or by name. These are evaluated on each update/render. |
| card            | object      | **Optional** | Card configuration.                               |
| row             | object      | **Optional** | Row configuration.                                |
| element         | object      | **Optional** | Element configuration.                            |
| style           | object      | **Optional** | Element Style configuration. Can only be used with `element`.    |

Exactly one of `card`, `row`, or `element` is required.

### Available variables for templating

| Variable    | Description                                                                        |
| ----------- | ---------------------------------------------------------------------------------- |
| `hass`      | The [hass](https://developers.home-assistant.io/docs/frontend/data/) object.       |
| `states`    | The [states](https://developers.home-assistant.io/docs/frontend/data/#hassstates) object. |
| `user`      | The [user](https://developers.home-assistant.io/docs/frontend/data/#hassuser) object. |
| `svars`     | Defined by `staticVariables` configuration and accessible in your templates to avoid redundant expensive operations. If `staticVariables` in the configuration is a yaml list, then `svars` is an array starting with index 0. If `staticVariables` in the configuration is an object, then `svars` is a string-indexed map and you can also access the variables by name without using `svars` at all. |
| `vars`      | Defined by `variables` configuration and accessible in your templates to help clean them up. If `variables` in the configuration is a yaml list, then `vars` is an array starting with index 0. If `variables` in the configuration is an object, then `vars` is a string-indexed map and you can also access the variables by name without using `vars` at all. |

## Examples

```yaml
type: 'custom:config-template-card'
variables:
  LIGHT_STATE: states['light.bed_light'].state
  GARAGE_STATE: states['cover.garage_door'].state
entities:
  - light.bed_light
  - cover.garage_door
  - alarm_control_panel.alarm
  - climate.ecobee
card:
  type: "${LIGHT_STATE === 'on' ? 'glance' : 'entities'}"
  entities:
    - entity: alarm_control_panel.alarm
      name: "${GARAGE_STATE === 'open' && states['alarm_control_panel.alarm'].state === 'armed_home' ? 'Close the garage!' : ''}"
    - entity: binary_sensor.basement_floor_wet
    - entity: climate.ecobee
      name: "${states['climate.ecobee'].attributes.current_temperature > 22 ? 'Cozy' : 'Too Hot/Cold'}"
    - entity: cover.garage_door
    - entity: "${LIGHT_STATE === 'on' ? 'light.bed_light' : 'climate.ecobee'}"
      icon: "${GARAGE_STATE === 'open' ? 'mdi:hotel' : '' }"
```

### Templated entities example

```yaml
type: 'custom:config-template-card'
variables:
  - states['sensor.light']
entities:
  - '${vars[0].entity_id}'
card:
  type: light
  entity: '${vars[0].entity_id}'
  name: "${vars[0].state === 'on' ? 'Light On' : 'Light Off'}"
```

### Picture-elements card example

```yaml
type: picture-elements
image: http://hs.sbcounty.gov/CN/Photo%20Gallery/_t/Sample%20Picture%20-%20Koala_jpg.jpg?Mobile=0
elements:
  - type: 'custom:config-template-card'
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
      - sensor.light_icon_color
    element:
      type: icon
      icon: "${vars[0] === 'on' ? 'mdi:home' : 'mdi:circle'}"
      style:
        '--paper-item-icon-color': "${ states['sensor.light_icon_color'].state }"
    style:
      top: 47%
      left: 75%
```

The `style` object on the element configuration is applied to the element itself, the `style` object on the `config-template-card` is applied to the surrounding card. Both can contain templated values. For example, in order to place the card properly, the `top` and `left` attributes must always be configured on the `config-template-card`.

### Entities card example

```yaml
type: entities
entities:
  - type: 'custom:config-template-card'
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
    row:
      type: section
      label: "${vars[0] === 'on' ? 'Light On' : 'Light Off'}"
  - entity: light.bed_light
```

### Markdown card example

```yaml
type: custom:config-template-card
entities:
  - sensor.outside_temperature
  - sensor.time
  - weather.home
variables:
  weather: |
    () => {
        let hass = document.querySelector("home-assistant").hass;
        let w = states['weather.home'].state;
        let key = 'component.weather.state._.' + w;
        return hass.resources[hass.language][key];
      }
  card:
    type: markdown
    content: |
      ### {{ states('sensor.outside_temperature') }} °C - ${weather()}
      # {{ states('sensor.time') }}
```

### Defining functions in variables

If you find yourself having to rewrite the same logic in multiple locations, you can define methods inside Config Template Card's variables, which can be called anywhere within the scope of the card:

```yaml
type: 'custom:config-template-card'
variables:
  setTempMessage: |
    (prefix, temp) => {
      if (temp <= 19) {
          return prefix + 'Quick, get a blanket!';
      }
      else if (temp >= 20 && temp <= 22) {
        return prefix + 'Cozy!';
      }
      return prefix + 'It's getting hot in here...';
    }
  currentTemp: states['climate.ecobee'].attributes.current_temperature
entities:
  - climate.ecobee
card:
  type: entities
  entities:
    - entity: climate.ecobee
      name: '${ setTempMessage("House: ", currentTemp) }'
```

### Asynchronous functions

Asynchronous functions can be used in most templates.

```yaml
type: 'custom:config-template-card'
entities:
  - light.bed_light
  - light.porch_light
card:
  type: entities
  entities:
    - entity: light.bed_light
      name: "${(async () => states['light.bed_light'].state === 'on' ? 'Bed Light On' : 'Bed Light Off' )();}"
    - entity: light.porch_light
      name: "${(async () => { return states['light.bed_light'].state === 'on' ? 'Porch Light On' : 'Porch Light Off'; })();}"
```

Card rendering will be delayed until all asynchronous functions (in all templates) have completed, so long-running asynchronous functions may prevent the card from rendering on page load or delay updates to the card.

When defining `staticVariables` that reference other (previously defined) `svars`, any referenced `svars` that use asynchronous functions will contain the unsettled `Promise` object.

Similarly, when defining `variables` that reference other (previously defined) `vars`, any referenced `vars` that use asynchronous functions will contain the unsettled `Promise` object. However, any referenced `svars` that use asynchronous functions will contain complete/settled values.

When defining `entities` that use templates, any `entities` templates that use asynchronous functions will be skipped, and any referenced `vars` that use asynchronous functions will contain the unsettled `Promise` object, which will not settle before `entities` is used. However, any referenced `svars` that use asynchronous functions will have complete/settled values.

(The reason that asynchronous functions cannot be used for `entities` is that Lit does not support asynchronous functions in `shouldUpdate()` where `entities` is evaluated and used.  The alternative [lovelace-card-templater](https://github.com/gadgetchnnel/lovelace-card-templater) cannot support templates in its `entities` for the same reason; it uses API calls to render templates, and API calls require the use of asynchronous functions.)

### Dashboard wide variables

If you need to use the same variable in multiple cards, then instead of defining it in each card's `variables` you can do that once for the entire dashboard.

```yaml
title: My dashboard

config_template_card_staticVars:
  lang: document.documentElement.lang
config_template_card_vars:
  - states['sensor.light'].state

views:
```

Both arrays and objects are supported, just like in card's local variables. It is allowed to mix the two types, i.e. use an array in dashboard variables and an object in card variables, or the other way around. If both definitions are arrays, then dashboard variables are put first in `svars`/`vars`. In the mixed mode, `svars`/`vars` have array indices as well as variable names.

After making changes to these variable definitions in the HA Dashboard Editor, you must reload the browser on any currently-open clients before you will see the changes.  Unlike card config changes which automatically update currently-open clients, dashboard wide variable config changes will not automatically update currently-open clients.

### Note: All templates must be enclosed by `${}`, except when defining variables.

`${}` is optional in variable definitions (variables will be parsed as templates even without `${}`).

Config values that begin with `${` and end with `}` are parsed as a single template, including any nested `${` and `}` sequences/characters.  For example, `${vars[0]}-${vars[1]}` will attempt to evaluate `vars[0]}-${vars[1]` and will fail due to the invalid `}` and `${`.

Config values that do not begin with `${` and end with `}` may contain multiple templates, however those templates cannot contain `}` characters.  For example, `${vars[0]}-${vars[1]}:` will work as expected, but `${() => { return 0; }}:` will fail due to the `}` character in the template.

Values that begin with `$! ` (`$!` followed by a space) will not be parsed for templates.  `$! ` will be stripped from the beginning of the value, but any `${}` sequences within the value will be left as-is.

## Troubleshooting

[General HA Plugin Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Developers

Fork and then clone the repo to your local machine. From the cloned directory run

`npm install && npm run build`


[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/config-template-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/config-template-card/commits/master
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/100-templatable-lovelace-configuration-card/105241
[license-shield]: https://img.shields.io/github/license/custom-cards/config-template-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-Ian%20Richardson%20%40iantrich-blue.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/config-template-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/config-template-card/releases
[twitter]: https://img.shields.io/twitter/follow/iantrich.svg?style=social
[github]: https://img.shields.io/github/followers/iantrich.svg?style=social
