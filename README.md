# EVRYTHNG-HUB.JS (plugin for EVT.js)

**evrythng-hub.js** is an extension plugin to be used with [evrythng.js](https://github.com/evrythng/evrythng.js) or 
[evrythng-extended.js](https://github.com/evrythng/evrythng-extended.js) JS libraries.

It adds the support for local requests within a THNGHUB environment. This means that, if the application makes a request
to any of the endpoints supported by THNGHUB (see [EVRYTHNG THNGHUB documentation](https://developers.evrythng.com/docs/thng-hub)), 
it will try locally by default and then the remote host, if the Hub is unavailable.

**evrythng-hub.js** is [UMD](https://github.com/umdjs/umd) compatible, meaning it just loads and works nicely 
in all contexts (Browser AMD, Node.js, Browser globals).

## Installation

### Browser

##### With [Bower](http://bower.io/)

    bower install evrythng-hub --save
    
The Bower package is [AMD](http://requirejs.org/docs/whyamd.html)-compatible. This means you can load 
it asynchronously using tools like [Require.js](http://requirejs.org/) or simply dropping the script tag 
into your HTML page:

    <script src="bower_components/evrythng-hub/dist/evrythng-hub.js"></script>

See [Usage](#usage) below for more details.

##### Load from CDN

Add the script tag into your HTML page:

    <script src="//cdn.evrythng.com/toolkit/evrythng-js-sdk/evrythng-hub-2.0.0.min.js"></script>
 
Or always get the last release:

    <script src="//cdn.evrythng.com/toolkit/evrythng-js-sdk/evrythng-hub.js"></script>
    <script src="//cdn.evrythng.com/toolkit/evrythng-js-sdk/evrythng-hub.min.js"></script>
    
For HTTPS you need to use:

    <script src="//d10ka0m22z5ju5.cloudfront.net/toolkit/evrythng-js-sdk/evrythng-hub-2.0.0.min.js"></script>
    <script src="//d10ka0m22z5ju5.cloudfront.net/toolkit/evrythng-js-sdk/evrythng-hub.js"></script>
    <script src="//d10ka0m22z5ju5.cloudfront.net/toolkit/evrythng-js-sdk/evrythng-hub.min.js"></script>
    
### Node.js

    npm install evrythng-hub --save

## Usage

#### RequireJS (AMD)

```javascript
requirejs.config({
    paths: {
        'evrythng': '../bower_components/evrythng/dist/evrythng',
        'evrythng-hub': '../bower_components/evrythng-hub/dist/evrythng-hub'
    }
});
    
require(['evrythng', 'evrythng-hub'], function (EVT, Hub) {

  EVT.use(Hub);
  ...
  
});
```

#### Node.js

```javascript
var EVT = require('evrythng'),
  hub = require('evrythng-hub');
  
EVT.use(hub);
...
```

#### Globals

```javascript
// The plugin is attached as EVT.Hub
EVT.use(EVT.Hub);
...
```

## Examples

#### General

After loading the plugin, using any of the methods above, and before starting to communicate with a 
THNGHUB, you need to setup the `targetHub` setting hub Thng that you want to talk to. Usually there
will be a single THNGHUB in the environment, though. The plugin provides an easy way to fetch the list 
of the  available hubs in the current project/context:

```javascript
EVT.use(Hub);

// Setup global settings
Hub.setup({
  timeout: 1000,        // local request timeout before switching to remote host
  remote: false         // make local requests by default (only to THNGHUB endpoints)
});

// Authenticate a user (app.login()), or create any other scope (TrustedApp, Operator)
var user = new EVT.User('USER_API_KEY');

user.getAvailableHubs().then(function(hubs) {

  EVT.Hub.setup({
    targetHub: hubs[0]
  });

  // Fetch local things via hubs[0]
  user.thng().read().then(function(localThngs) {
    console.log(localThngs);
  });
  
  // Read remote thngs explicitly
  user.thng().read({ remote: true }).then(function(remoteThngs){
    console.log(remoteThngs);
  });

});

```

The `targetHub` property contains all the necessary configuration (IP address, Port numbers and Security settings)
used by that particular hub, so the client does not need to know the HTTP, MQTT or WebSockets URLs
or handle the encryption required by different hubs.

View all the supported endpoints on the hub [here](https://developers.evrythng.com/docs/thng-hub#section-local-apis).

#### Usage with MQTT/WS plugins

**Note:** In order to connect to THNGHUB over MQTT/WebSockets you will need to add and install [`evrythng-mqtt.js`](https://github.com/evrythng/evrythng-mqtt.js)
 or [`evrythng-ws.js`](https://github.com/evrythng/evrythng-ws.js) together with **evrythng-hub**. 
 Refer to these dependencies READMEs for installation and usage instructions.

When using the MQTT or WS plugin, the Hub plugin will first try to connect to the specified local hub URL (configured in
the settings) and falls back to the remote cloud URL if it fails, making it transparent for the developer and application user
if they are talking to the local Hub or the cloud API.

Install both plugins. Hub plugin should come after MQTT/WS.

```javascript
EVT.use(mqtt).use(hub);

hub.setup({
  targetHub: <hub thng> // see above
});
```

As before, by setting the `targetHub` the SDK will know the correct MQTT/WS urls to establish the connections.

Make requests and subscriptions as if you were talking to the cloud.

```javascript
user.thng('{thndId}').property('temperature').subscribe(function(tempUpdate){
  // Update coming from THNGHUB or directly from the cloud.
  console.log(tempUpdate);
});
```

#### Secure Mode

In order to talk to hubs that require encryption you need to have [node-jose](https://github.com/cisco/node-jose) 
([node-jose-browserified](https://github.com/jean-moldovan/node-jose-browserified) for browsers) 
and [jsrsasign](https://github.com/kjur/jsrsasign) installed. These dependencies are automatically
loaded into `node_modules` or `bower_components` folder when you install the plugin via `npm`/`bower`.

The plugin will use the encryption defined in the THNGHUB startup settings.

---

## Documentation

Check the THNGHUB REST API documentation on the [EVRYTHNG THNGHUB documentation](https://developers.evrythng.com/docs/thng-hub).

## Source Maps

Source Maps are available, which means that when using the minified version, if you open 
Developer Tools (Chrome, Safari, Firefox), *.map* files will be downloaded to help you debug code using the 
original uncompressed version of the library.

## Related tools

#### evrythng.js

[`evrythng.js`](https://github.com/evrythng/evrythng.js) is the core version of *evrythng.js* intended to be used in 
public applications and/or devices.

#### evrythng-extended.js

[`evrythng-extended.js`](https://github.com/evrythng/evrythng-extended.js) is an extended version of *evrythng.js* which 
includes Operator access to the API.

## License

Apache 2.0 License, check `LICENSE.txt`

Copyright (c) EVRYTHNG Ltd.
