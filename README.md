# EVRYTHNG-HUB.JS

**evrythng-hub.js** is an extension plugin to be used with [evrythng.js](https://github.com/evrythng/evrythng.js) or 
[evrythng-extended.js](https://github.com/evrythng/evrythng-extended.js) JS libraries.
It adds the support for local requests within a Thng-Hub environment. This means that, if the app makes a request
to any of the endpoints supported by Thng-Hub (see [EVRYTHNG Thng-Hub documentation]()), it will try locally by
default and then the remote host.

## Installation

### [Bower](http://bower.io/)

    bower install evrythng-hub
    
Then just load the script in your page:

    <script src="bower_components/evrythng-hub/dist/evrythng-hub.js"></script>

### [NPM](https://www.npmjs.com/)

    npm install evrythng-hub

## Usage

**evrythng-hub** is UMD compatible, meaning it just loads and works nicely in all contexts.

### With RequireJS (AMD)

```javascript
var bowerPath = '../bower_components/'; // replace with path to your local bower directory
requirejs.config({
    paths: {
        'evrythng': bowerPath + 'evrythng/dist/evrythng',
        'evrythng-hub': bowerPath + 'evrythng-hub/dist/evrythng-hub'
    }
});
    
require(['evrythng', 'evrythng-hub'], function (EVT, Hub) {

  EVT.use(Hub);
  ...
  
});
```

### With Browser Globals

```javascript
// The plugin is attached as EVT.Hub
EVT.use(EVT.Hub);
...
```

### With Node.js

```javascript
var EVT = require('evrythng'),
  hub = require('evrythng-hub');
  
EVT.use(hub);
...
```

### Examples

```javascript
// After loading the plugin, using any of the methods above, you should provide the 
// Thng-Hub local API url to the Hub plugin
Hub.setup({
  apiUrl: 'http://192.168.0.12:8080',
  timeout: 1000,    // local request timeout before switching to remote host
  remote: false     // make local requests by default (only to thng-hub endpoints)
});

// Init app and user (see https://github.com/evrythng/evrythng.js)

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
```

## Documentation

Check the Thng-Hub documentation on the [EVRYTHNG Thng-Hub documentation]().
