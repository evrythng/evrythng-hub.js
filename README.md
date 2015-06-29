# EVRYTHNG-HUB.JS (plugin for EVT.js)

**evrythng-hub.js** is an extension plugin to be used with [evrythng.js](https://github.com/evrythng/evrythng.js) or 
[evrythng-extended.js](https://github.com/evrythng/evrythng-extended.js) JS libraries.

It adds the support for local requests within a Thng-Hub environment. This means that, if the application makes a request
to any of the endpoints supported by Thng-Hub (see [EVRYTHNG Thng-Hub documentation](https://dashboard.evrythng.com/developers/apidoc/thng-hub)), 
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

    <script src="//cdn.evrythng.net/toolkit/evrythng-js-sdk/evrythng-hub-1.0.2.min.js"></script>
 
Or always get the last release:

    <script src="//cdn.evrythng.net/toolkit/evrythng-js-sdk/evrythng-hub.js"></script>
    <script src="//cdn.evrythng.net/toolkit/evrythng-js-sdk/evrythng-hub.min.js"></script>
    
For HTTPS you need to use:

    <script src="//d10ka0m22z5ju5.cloudfront.net/toolkit/evrythng-js-sdk/evrythng-hub-1.0.2.min.js"></script>

Respectively:

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

### Node.js

```javascript
var EVT = require('evrythng'),
  hub = require('evrythng-hub');
  
EVT.use(hub);
...
```

### Globals

```javascript
// The plugin is attached as EVT.Hub
EVT.use(EVT.Hub);
...
```

## Examples

#### General

```javascript
// After loading the plugin, using any of the methods above, you 
// should provide the Thng-Hub local API url to the Hub plugin (below are defaults)
Hub.setup({
  apiUrl: 'http://192.168.0.12:8080',
  timeout: 1000,        // local request timeout before switching to remote host
  remote: false         // make local requests by default (only to thng-hub endpoints)
});

// Init app and user (see https://github.com/evrythng/evrythng.js)
...

// Read local thngs if thng-hub is accessible
user.thng().read().then(function(thngs){
  console.log(thngs);
});

// Read remote thngs explicitly
user.thng().read({ remote: true }).then(function(thngs){
  console.log(thngs);
});

// Update thng property remotely
user.thng('{thngId}').property('{propertyKey}').update(123, { remote: true }).then(...);

...
```

---

## Documentation

Check the Thng-Hub REST API documentation on the [EVRYTHNG Thng-Hub documentation](https://dashboard.evrythng.com/developers/apidoc/thng-hub).

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
