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

// ### Encryption

// evrythng-hub.js fetches the distributed hub configuration from the cloud
// on request. The user can then specify which hub they want to use as
// the local gateway. The plugin uses the configuration specified in the
// Hub's custom fields, including encryption.

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

    // evrythng-ws, jsrsasign, node-jose-browserified
    // deps are optional.
    define([
      'optional!evrythng-ws',
      'optional!jsrsasign',
      'optional!node-jose-browserified'
    ], function (WS, JWT, Jose) {
      return factory(undefined, WS, JWT, Jose);
    });

  } else if (typeof exports === 'object') {

    // Node/CommonJS

    // evrythng-mqtt, jsrsasign, node-jose deps are optional.
    var MQTT, JWT, Jose, tryLoading;

    tryLoading = function (name) {
      var module;

      try {
        module = require(name);
      } catch (e) {
        // do nothing
      } finally {
        return module;
      }
    };

    MQTT = tryLoading('evrythng-mqtt');
    JWT = tryLoading('jsrsasign');
    Jose = tryLoading('node-jose');

    module.exports = factory(MQTT, undefined, JWT, Jose);

  } else {

    // Browser globals

    root.EVT.Hub = root.Evrythng.Hub = factory(undefined, root.EVT.WS, root.KJUR, root.nodeJose);

  }

}(this, function (MQTT, WS, JWT, Jose) {
  'use strict';

  var version = '2.0.0';

  // Setup default settings:

  // - _**timeout**: Timeout in milliseconds for local requests, before switching to remote_
  // - _**remote**: Explicitly switch the requests to use the default remote/cloud URLs_
  // - _**targetHub**: Hub to be used as local gateway_.
  var defaultSettings = {
    timeout: 1000,
    remote: false,
    targetHub: null
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

  // Pubsub plugin used in conjunction with the Hub.
  var pubSubPlugin = MQTT || WS;

  // Cached map for {'apiKey': {'hubId': 'encryptedApiKey'} }
  var encryptedKeyMap = {};


  // Check if a variable is an Object
  function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  // Build url based on protocol, ip and port.
  function buildUrl(protocol, ip, port) {
    var url = protocol + '://' + ip + ':' + port;
    if(protocol !== 'http'){
      url += '/mqtt';
    }
    return url;
  }

  // Generate a unique id to create a jti claim in jsonwebtoken.
  function generateId() {
    return Jose.util.base64url.encode(Jose.util.randomBytes(32));
  }

  // Init secret key. Needed for encryption/decryption.
  function initSecretKey(key) {
    return Jose.JWK.asKey(key);
  }

  // Create encryption (JWE).
  function encrypt(input, key, options) {
    if (isObject(input)) {
      input = JSON.stringify(input);
    }

    return Jose.JWE
      .createEncrypt(options || {}, key)
      .update(input)
      .final();
  }

  // Create decryption (JWE). Resolved with plaintext of the result.
  function decrypt(input, key) {
    return Jose.JWE
      .createDecrypt(key)
      .decrypt(input)
      .then(function (result) {
        return result.plaintext.toString();
      });
  }

  // Create a jsonwebtoken and sign it using secret key ID.
  function createJWT(options, kid) {
    var header = {alg: 'HS256', typ: 'JWT'};
    var claims = {
      iss: options.iss,
      aud: options.aud,
      sub: options.sub,
      jti: options.jti || generateId(),
      data: options.data
    };

    return JWT.jws.JWS.sign('HS256', JSON.stringify(header), JSON.stringify(claims), kid);
  }

  // Verify signature and validate a jsonwebtoken.
  function verifyJWT(input, kid, validateOptions) {
    validateOptions = validateOptions || {};
    validateOptions.alg = ['HS256'];

    return JWT.jws.JWS.verifyJWT(input, kid, validateOptions);
  }

  // Split JWT into header and payload, decode them.
  function decodeJWT(input) {
    input = input.split('.');

    return {
      header: JSON.parse(decode(input[0])),
      payload: JSON.parse(decode(input[1]))
    };
  }

  // Syntax sugar for encrypting header.
  function encryptAuthorization(authorization, secretKey) {
    return encrypt(authorization, secretKey, { format: 'compact' });
  }

  // Create jwt first, then encrypt payload.
  function encryptPayload(payload, secretKey, options) {
    var jwt = createJWT({
      iss: options.iss,
      aud: options.aud,
      sub: options.sub,
      data: payload
    }, secretKey.kid);

    return encrypt(jwt, secretKey);
  }

  // Decrypt the payload first, then verify jsonwebtoken and decode it.
  function decryptPayload(payload, secretKey, options) {
    return decrypt(payload, secretKey)
      .then(function (jwt) {
        var isValid = verifyJWT(jwt, secretKey.kid, {
          iss: [options.iss],
          aud: [options.aud],
          sub: [options.sub]
        });

        if (isValid) {
          return decodeJWT(jwt).payload.data;
        } else {
          throw new Error('Unable to verify jsonwebtoken.');
        }
      });
  }

  // Decode base64 string.
  function decode(input) {
    return Jose.util.base64url.decode(input, 'utf8');
  }

  // Check if url and method are supported by the hub endpoints.
  function isSupported(url, method) {
    method = method || 'get';

    // Get only the path (no query strings, etc.)
    var path = /^(.*?)(\?|$)/.exec(url)[1];

    // Check if it is a local request. Path and method should
    // exist in the mapping above.
    for (var i = 0; i < localEndpoints.length; i++) {
      if (localEndpoints[i].path.test(path) &&
        localEndpoints[i].method.indexOf(method) !== -1) {
        return true;
      }
    }

    return false;
  }


  // Plugin API
  var EVTHubPlugin = {

    version: version,

    settings: defaultSettings,

    setup: function (customSettings) {
      if (isObject(customSettings)) {

        // Override default settings with new ones
        for (var i in customSettings) {
          if (customSettings.hasOwnProperty(i)) {
            this.settings[i] = customSettings[i];
          }
        }

      } else {
        throw new TypeError('Setup should be called with an options object.');
      }

      // Init secret key if setting up a new targetHub
      if(customSettings.targetHub && customSettings.targetHub.customFields.key){
        this.settings.targetHub.customFields.secretKey =
          initSecretKey(customSettings.targetHub.customFields.key);
      }

      return this.settings;
    },

    install: function (EVT, Scope, Resource, Utils, Logger) {
      var $this = this;
      var original = {
        api: EVT.api,
        subscribe: Resource.prototype.subscribe,
        publish: Resource.prototype.publish
      };

      EVT.api = localApi;
      Scope.prototype.getAvailableHubs = getAvailableHubs;

      // Patch Pubsub methods. Unsubscribe does not create any connection.
      if (pubSubPlugin) {
        Resource.prototype.subscribe = localPubSub('subscribe');
        Resource.prototype.publish = localPubSub('publish');
      }


      // PATCHES

      function localApi(options) {
        var args = arguments;
        var previousInterceptors = (options.interceptors || [])
          .concat(EVT.settings.interceptors || []);

        var interceptors = [{
          request: filterRemoteRequest
        }, {
          request: getRequestConfig('http')
        }, {
          request: buildEncrypted
        }, {
          request: function (opts) {
            if(!opts.remote) {
              opts.timeout = $this.settings.timeout;
            }
          }
        }];

        options.interceptors = previousInterceptors.concat(interceptors);

        return original.api.apply(EVT, args)
          .catch(function (err) {

            // Request has been cancelled by pubSub plugin. Do nothing.
            if (pubSubPlugin && err && err.cancelled) {
              return;
            }

            // Local REST is not available. Switch to remote.
            // Allow local requests to fail (404, 400, etc.)
            // without falling back to remote.
            if(err && err.status === 0){
              Logger.info('Local hub is unavailable. Switching to remote...');

              delete options.timeout;
              options.interceptors = previousInterceptors;

              return original.api.apply(EVT, args);
            } else {
              throw err;
            }

          });
      }

      function localPubSub(method) {
        return function () {
          var args = Array.prototype.slice.call(arguments),
            $resource = this,
            protocol = pubSubPlugin === MQTT? 'mqtt' : 'ws',
            remoteOptions = {
              apiUrl: pubSubPlugin.settings.apiUrl,
              url: $resource.path,
              authorization: $resource.scope.apiKey,
              targetHub: $this.settings.targetHub
            },
            options = {},
            cachedData = args[0];

          var interceptors = [{
            request: filterRemoteRequest
          }, {
            request: getRequestConfig(protocol)
          }, {
            request: buildEncrypted
          }, {
            request: function (opts, cancel) {
              Utils.extend(options, opts, true);
              cancel();
            }
          }];

          // Get configuration and encrypted options by calling .api()
          // with request interceptors.
          return original.api({
            authorization: $resource.scope.apiKey,
            url: $resource.path,
            interceptors: interceptors
          }).catch(function () {

            if(!options.remote){
              var connectOptions = {
                authorization: options.headers.authorization,
                apiUrl: options.apiUrl
              };

              // Add connect options in second argument.
              // First is always the callback (subscribe) or
              // the message (publish).
              if(Utils.isFunction(args[1])){
                args.splice(1, 0, connectOptions);
              } else {
                args[1] = Utils.extend(args[1], connectOptions);
              }

              // Decrypt message before calling message callback.
              if (method === 'subscribe' && $this.settings.targetHub.customFields.security.response) {
                args[0] = secureCallback(args[0], remoteOptions);
              }
            }

            return original[method].apply($resource, args)
              .catch(function () {

                // Local PubSub is not available. Switch to remote.
                Logger.info('Local hub is unavailable. Switching to remote...');

                // Reset connectOptions and data/callback.
                args[0] = cachedData;
                args[1] = {};

                return original[method].apply($resource, args);
              });

          });
        };
      }

      function getAvailableHubs() {
        // This runs in the context of a Scope which contains an apiKey.
        return Promise.resolve()
          .then(getDistributedCollectionId(this.apiKey))
          .then(getDistributedHubs(this.apiKey));
      }


      // INTERCEPTORS

      // Check if url is supported and return regex object.
      function filterRemoteRequest(options) {
        options.remote = isRemote(options) || !isSupported(options.url, options.method);
        return options;
      }

      // Get hub configuration and apiUrl for protocol.
      function getRequestConfig(protocol){
        return function (options) {
          if(options.remote){
            return options;
          }

          if(!$this.settings.targetHub){
            throw new Error('There is no "targetHub" property in the settings.');
          }

          options.apiUrl = buildUrl(
            protocol,
            $this.settings.targetHub.customFields.ip.v4,
            $this.settings.targetHub.customFields.ports[protocol]
          );
          return options;
        };
      }

      // Encrypt apiKey/payload (secure mode)
      function buildEncrypted(options) {
        // is remote, or there is no security
        if (options.remote ||
          !($this.settings.targetHub.customFields.security.request ||
          $this.settings.targetHub.customFields.security.response)) {
          return options;
        }

        if(!$this.settings.targetHub.customFields.secretKey){
          throw new Error('THNGHUB=[' + $this.settings.targetHub.id + '] requires ' +
            'encryption, but there is no encryption key.');
        }

        var originalOptions = {
          authorization: options.authorization,
          url: options.url,
          targetHub: $this.settings.targetHub
        };

        return Promise.all([
          encryptApiKey(options.authorization, options),
          encryptData(options.data, options)
        ]).then(function (encrypted) {
          var encryptedKey = encrypted[0];
          var encryptedData = encrypted[1];

          options.headers.authorization = encryptedKey;
          if(encryptedData) {
            options.data = encryptedData;
          }

          // Add response interceptor with closure to original options.
          if($this.settings.targetHub.customFields.security.response){
            options.interceptors = [{
              response: function(res) {
                return decryptData(res, originalOptions);
              }
            }];
          }

          return options;
        });
      }


      // HELPERS

      // Returns current option's remote setting or the global setting.
      function isRemote(options) {
        return options.remote !== undefined ? options.remote : $this.settings.remote;
      }

      // Get distrubuted collection from cloud using scope's apiKey.
      function getDistributedCollectionId(apiKey) {
        return function () {
          return original.api({
            url: '/collections',
            params: { filter: 'tags=HubDistribution' },
            authorization: apiKey
          }).then(function (cols) {
            if(!cols.length) {
              throw new Error('There is no distributed collection in this project.');
            }
            return cols[0].id;
          });
        };
      }

      // Get all hubs from distributed collection using scope's apiKey.
      function getDistributedHubs(apiKey) {
        return function (collectionId) {
          return original.api({
            url: '/collections/' + collectionId + '/thngs',
            authorization: apiKey
          }).then(function (thngs) {
            if(!thngs.length) {
              throw new Error('There are no THNGHUBS in the distributed collection.');
            }

            // Only return hubs that are connected
            return thngs.filter(function (hub) {
              return hub.properties['~connected'];
            });
          });
        };
      }

      // Encrypt apiKey or get from cache.
      function encryptApiKey(apiKey, options) {
        if(encryptedKeyMap[apiKey] &&
          encryptedKeyMap[apiKey][$this.settings.targetHub.id]){
          // pre cached key for this hub
          return Promise.resolve(encryptedKeyMap[apiKey][$this.settings.targetHub.id]);
        } else {
          // encrypt and cache key for this hub
          return $this.settings.targetHub.customFields.secretKey
            .then(function (secretKey) {
              return encryptAuthorization(apiKey, secretKey);
            })
            .then(function (encryptedApiKey) {
              encryptedKeyMap[apiKey] = encryptedKeyMap[options.authorization] || {};
              encryptedKeyMap[apiKey][$this.settings.targetHub.id] = encryptedApiKey;
              return encryptedApiKey;
            });
        }
      }

      // Encrypt data if any.
      function encryptData(data, options) {
        if(data){
          return $this.settings.targetHub.customFields.secretKey
            .then(function (secretKey) {
              return encryptPayload(data, secretKey, {
                iss: options.authorization,
                aud: $this.settings.targetHub.id,
                sub: options.url
              });
            });
        }
      }

      // Decrypt data if any.
      function decryptData(data, options) {
        if (data) {
          return $this.settings.targetHub.customFields.secretKey
            .then(function (secretKey) {
              return decryptPayload(data, secretKey, {
                aud: options.authorization,
                iss: options.targetHub.id,
                sub: options.url
              });
            });
        }
      }

      // Decrypt payload on subscription callbacks in secure environments
      function secureCallback(cb, options) {
        return function (msg) {
          var resource = msg.resource;

          return $this.settings.targetHub.customFields.secretKey
            .then(function (secretKey) {
              return decryptPayload(msg, secretKey, {
                aud: options.authorization,
                iss: options.targetHub.id,
                sub: options.url
              });
            }).then(function (decrypted) {
              return cb(resource.parse(decrypted));
            });
        };
      }

    }
  };

  // Attach useful utils methods to the plugin.
  if (JWT && Jose) {
    EVTHubPlugin.utils = {
      generateId: generateId,
      initSecretKey: initSecretKey,
      encrypt: encrypt,
      decrypt: decrypt,
      createJWT: createJWT,
      verifyJWT: verifyJWT,
      decodeJWT: decodeJWT,
      encryptAuthorization: encryptAuthorization,
      encryptPayload: encryptPayload,
      decryptPayload: decryptPayload
    };
  }

  // Modules that this plugin requires. Injected into the install method.
  EVTHubPlugin.$inject = ['core', 'scope/scope', 'resource', 'utils', 'logger'];

  return EVTHubPlugin;

}));
