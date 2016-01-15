# v1.1.1 (15-01-2016)

## Changes

- **Docs**: update README instructions for using MQTT/WS plugin with the Hub.

# v1.1.0 (22-12-2015)

## Features

- **Pubsub integration**: connect to local Thng-Hub's WS/MQTT server.

## Changes

- **apiUrl**: renamed setting to httpApiUrl, as wsApiUrl and mqttApiUrl are now available.
Old setting still accepted with deprecation warning.

# v1.0.3 (07-10-2015)

## Bug fixes

- **Plugin API**: updated to conform with the Plugin API (`$inject` instead of `requires for dependencies).

# v1.0.2 (25-06-2015)

## Features

- **documentation**: updated documentation with consistent format from other libs.

# v1.0.1 (24-06-2015)

## Bug Fixes

- **package.json**: `request` dependency removed, as this is part of `evrythng.js`.

# v1.0.0 (22-06-2015)

## Features

- **Hub endpoints**: requests to Thng-Hub-compatible endpoints go to the local Hub url instead of the cloud.
