// ## EVRYTHNG-HUB.JS Plugin

// This plugin allows the evrythng.js to communicate to a local API
// if available (e.g. inside home), and retry to the cloud if the specified
// API is not available (e.g. outside home).

// The following methods support local HTTP requests:

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

// ### Pubsub

// Can be used on top of evrythng-ws.js and evrythng-mqtt.js to provide
// the ability to connect to local WS and MQTT servers as well.

(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {

    // AMD

    // Define optional RequireJS plugin first.
    // http://stackoverflow.com/a/27422370/130480
    define("optional", [], {
      load: function (moduleName, parentRequire, onload) {

        var onLoadSuccess = function (moduleInstance) {
          onload(moduleInstance);
        };

        var onLoadFailure = function (err) {
          var failedId = err.requireModules && err.requireModules[0];

          // Undefine the module to cleanup internal stuff.
          requirejs.undef(failedId);
          define(failedId, [], function () {
          });
          parentRequire([failedId], onLoadSuccess);
        };

        parentRequire([moduleName], onLoadSuccess, onLoadFailure);
      }
    });

    // evrythng-ws dependency is optional.
    define(['optional!evrythng-ws'], function (WS) {
      return factory(undefined, WS);
    });

  } else if (typeof exports === 'object') {

    // Node/CommonJS

    // evrythng-mqtt depdency is optional.
    var MQTT;
    try {
      MQTT = require('evrythng-mqtt');
    } catch (e) {
      MQTT = undefined;
    }
    module.exports = factory(MQTT, undefined);

  } else {

    // Browser globals
    root.EVT.Hub = root.Evrythng.Hub = factory(undefined, root.EVT.WS);

  }

}(this, function (MQTT, WS) {
  'use strict';

  var version = '1.1.0';


  // Setup default settings:

  // - _**httpApiUrl**: Local Thng-Hub HTTP API URL_
  // - _**mqttApiUrl**: Local Thng-Hub MQTT API URL_
  // - _**wsApiUrl**: Local Thng-Hub Web Socket API URL_
  // - _**timeout**: Timeout in milliseconds for local requests, before switching to remote_
  // - _**remote**: Explicitly switch the requests to use the default remote/cloud URLs_
  var defaultSettings = {
    httpApiUrl: 'http://localhost:8787',
    mqttApiUrl: 'mqtt://localhost:4001/mqtt',
    wsApiUrl: 'ws://localhost:4000/mqtt',
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
      //.thng('{thngId}').property('{propertyName}').read/update()
      path: /^\/thngs\/[^\/]+\/properties\/[^\/]+$/,
      method: ['get', 'put']
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

    // Setup new settings.
    setup: function (customSettings) {
      if (Object.prototype.toString.call(customSettings) === '[object Object]') {

        // Override default settings with new ones
        for (var i in customSettings) {
          if (customSettings.hasOwnProperty(i)) {

            // TODO deprecate
            if (i === 'apiUrl') {
              console.warn('[EvrythngJS Hub] apiUrl option has been deprecated. Use httpApiUrl instead.');
              this.settings.httpApiUrl = customSettings[i];
              continue;
            }

            this.settings[i] = customSettings[i];
          }
        }

      } else {
        throw new TypeError('Setup should be called with an options object.');
      }

      return this.settings;
    },

    install: function (EVT, Resource) {
      var $this = this,
        pubSubPlugin = MQTT || WS;

      var original = {
        api: EVT.api,
        subscribe: Resource.prototype.subscribe,
        publish: Resource.prototype.publish
      };

      function localApi(options) {
        var remote = options.remote !== undefined ? options.remote : $this.settings.remote;
        if (remote) {
          return original.api.apply(EVT, arguments);
        }

        // Get only the path (no query strings, etc.)
        var path = /^(.*?)(\?|$)/.exec(options.url)[1],
          method = options.method || 'get',
          args = arguments;

        // Check if it is a local request. Path and method should exist
        // in the mapping above.
        for (var i = 0; i < localEndpoints.length; i++) {
          if (localEndpoints[i].path.test(path) && localEndpoints[i].method.indexOf(method) !== -1) {
            break;
          }
        }

        if (i < localEndpoints.length) {
          // Is local endpoint / supported by thng-hub

          // Use local request settings
          options.apiUrl = $this.settings.httpApiUrl;
          options.timeout = $this.settings.timeout;

          return original.api.apply(EVT, args).catch(function (err) {

            if (pubSubPlugin && err && err.cancelled) {
              return;
            }

            // Use original settings.
            delete options.apiUrl;
            delete options.timeout;

            return original.api.apply(EVT, args);

          });

        } else {

          // Normal request
          return original.api.apply(EVT, args);

        }
      }

      function localPubsubMethod(method) {
        return function () {
          if ($this.settings.remote) {
            return original[method].apply(this, arguments);
          }

          var remoteApiUrl = pubSubPlugin.settings.apiUrl,
            localApiUrl = pubSubPlugin === MQTT ? $this.settings.mqttApiUrl : $this.settings.wsApiUrl,
            $resource = this,
            args = arguments;

          // Try local endpoint first.
          pubSubPlugin.setup({
            apiUrl: localApiUrl
          });

          return original[method].apply($resource, args).catch(function () {

            // Fallback to remote endpoint.
            pubSubPlugin.setup({
              apiUrl: remoteApiUrl
            });

            return original[method].apply($resource, args);
          });
        };
      }

      // Patch .api() method.
      EVT.api = localApi;

      // Patch Pubsub methods.
      // Unsubscribe does not create any connection.
      if (pubSubPlugin) {
        Resource.prototype.subscribe = localPubsubMethod('subscribe');
        Resource.prototype.publish = localPubsubMethod('publish');
      }
    }

  };

  // Modules that this plugin requires. Injected into the install method.
  EVTHubPlugin.$inject = ['core', 'resource'];

  return EVTHubPlugin;

}));
