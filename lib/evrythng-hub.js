// ## EVRYTHNG-HUB.JS Plugin

// This is plugin allows the evrythng.js to communicate to a local API
// if available (e.g. inside home), and retry to the cloud if the specified
// API is not available (e.g. outside home).

// The following methods support local requests:

//  - .thng('{thngId}').read()
//  - .thng('{thngId}').property('{propertyName}').read()
//  - .thng('{thngId}').property('{propertyName}').create()
//  - .thng('{thngId}').property('{propertyName}').update()
//  - .thng('{thngId}').action('{actionType}').read()
//  - .thng('{thngId}').action('{actionType}').create()
//  - .thng('{thngId}').action('{actionType}', '{actionId}').read()

//  - .collection('{collectionId}').read()
//  - .collection('{collectionId}').thng().read()
//  - .collection('{collectionId}').action('{actionType}').read()
//  - .collection('{collectionId}').action('{actionType}').create()
//  - .collection('{collectionId}').action('{actionType}', '{actionId}').read()

//  - .actionType().read()

(function (root, factory) {

  if (typeof define === 'function' && define.amd) {

    // AMD.
    define(factory());

  } else if (typeof exports === 'object') {

    // Node/CommonJS
    module.exports = factory();

  } else {

    // Browser globals
    root.EVT.Hub = root.Evrythng.Hub = factory();

  }

}(this, function () {
  'use strict';

  // Version of plugin maintained in sync with every release of evt.js
  var version = '1.0.1';


  // Setup default settings:

  // = ***apiUrl**: Local Thng-Hub API URL
  // - ***timeout**: Timeout in milliseconds for local requests, before switching to remote*
  var defaultSettings = {
    apiUrl: 'http://localhost:8080',
    timeout: 1000,
    remote: false
  };


  // List of local endpoints supported by thng-hub. We use paths checking
  // on the global EVT.api() method, instead of patching all resources
  // since the user can make these calls using the raw api method.
  var localEndpoints = [
    {
      //.thng().read()
      path: /^\/thngs$/,
      method: ['get']
    }, {
      //.thng('{thngId}').read()
      path: /^\/thngs\/[^\/]+$/,
      method: ['get']
    }, {
      //.thng('{thngId}').property().read/create/update()
      path: /^\/thngs\/[^\/]+\/properties$/,
      method: ['post', 'get', 'put']
    }, {
      //.thng('{thngId}').property('{propertyName}').read/create/update()
      path: /^\/thngs\/[^\/]+\/properties\/[^\/]+$/,
      method: ['post', 'get', 'put']
    }, {
      //.thng('{thngId}').action('{actionType}').read/create()
      path: /^\/thngs\/[^\/]+\/actions\/[^\/]+$/,
      method: ['post', 'get']
    }, {
      //.thng('{thngId}').action('{actionType}', '{actionId}').read()
      path: /^\/thngs\/[^\/]+\/actions\/[^\/]+\/[^\/]+$/,
      method: ['get']
    }, {
      //.collection().read()
      path: /^\/collections$/,
      method: ['get']
    }, {
      //.collection('{collectionId}').read()
      path: /^\/collections\/[^\/]+$/,
      method: ['get']
    }, {
      //.collection('{collectionId}').thng().read()
      path: /^\/collections\/[^\/]+\/thngs$/,
      method: ['get']
    }, {
      //.collection('{collectionId}').action('{actionType}').read/create()
      path: /^\/collections\/[^\/]+\/actions\/[^\/]+$/,
      method: ['post', 'get']
    }, {
      //.collection('{collectionId}').action('{actionType}', '{actionId}').read()
      path: /^\/collections\/[^\/]+\/actions\/[^\/]+\/[^\/]+$/,
      method: ['get']
    }, {
      // .actionType().read()
      path: /^\/actions$/,
      method: ['get']
    }
  ];


  // Plugin API
  var EVTHubPlugin = {

    version: version,

    settings: defaultSettings,

    // Modules that this plugin requires. Injected into the install method.
    requires: ['core'],

    // Setup new settings.
    setup: function (customSettings) {
      if (Object.prototype.toString.call(customSettings) === '[object Object]') {

        // Override default settings with new ones
        for (var i in customSettings) {
          if (customSettings.hasOwnProperty(i)) {
            this.settings[i] = customSettings[i];
          }
        }

      } else {
        throw new TypeError('Setup should be called with an options object.');
      }

      return this.settings;
    },

    install: function (EVT) {
      var $this = this;
      var originalApi = EVT.api;

      // Patch .api() method...
      EVT.api = function (options) {
        var remote = options.remote !== undefined? options.remote : EVTHubPlugin.settings.remote;
        if(remote){
          return originalApi.apply(null, arguments);
        }

        // Get only the path (no query strings, etc.)
        var path = /^(.*?)(\?|$)/.exec(options.url)[1],
          method = options.method || 'get',
          args = arguments;

        // Check if it is a local request. Path and method should exist
        // in the mapping above.
        for (var i = 0; i < localEndpoints.length; i++) {
          if(localEndpoints[i].path.test(path) && localEndpoints[i].method.indexOf(method) !== -1){
            break;
          }
        }

        if(i < localEndpoints.length){
          // Is local endpoint / supported by thng-hub

          // Use local request settings
          options.apiUrl = $this.settings.apiUrl;
          options.timeout = $this.settings.timeout;

          return originalApi.apply(null, args).catch(function () {

            // User original settings
            delete options.apiUrl;
            delete options.timeout;

            return originalApi.apply(null, args);
          });

        } else {

          // Normal request
          return originalApi.apply(null, args);

        }

      };
    }
  };

  return EVTHubPlugin;
}));
