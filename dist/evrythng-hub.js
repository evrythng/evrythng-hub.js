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

// Supports local encryption mechanism of a Thng-Hub.

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

  var version = '1.2.0';

  // Setup default settings:

  // - _**httpApiUrl**: Local Thng-Hub HTTP API URL_
  // - _**mqttApiUrl**: Local Thng-Hub MQTT API URL_
  // - _**wsApiUrl**: Local Thng-Hub Web Socket API URL_
  // - _**timeout**: Timeout in milliseconds for local requests, before switching to remote_
  // - _**remote**: Explicitly switch the requests to use the default remote/cloud URLs_
  // - _**secure**: Enable/disable encryption when talking to the Thng-Hub Local API (REST, MQTT, WS).
  // Secure mode requires hubId to be defined_
  // - _**hubId**: Thng ID that corresponds to Hub_.
  var defaultSettings = {
    httpApiUrl: 'http://localhost:8787',
    mqttApiUrl: 'mqtt://localhost:4001/mqtt',
    wsApiUrl: 'ws://localhost:4000/mqtt',
    timeout: 1000,
    remote: false,
    secure: false,
    hubId: null
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

  function _isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  // Generate a unique id. Useful for creating
  // jti claim in jsonwebtoken.
  //
  // @return String

  function generateId() {
    return Jose.util.base64url.encode(Jose.util.randomBytes(32));
  }


  // Init secret key. Needed for
  // encryption/decryption.
  //
  // @return Promise

  function initSecretKey(key) {
    return Jose.JWK.asKey(key);
  }


  // Create encryption (JWE).
  //
  // @return Promise

  function encrypt(input, key, options) {
    options = options || {};

    if (_isObject(input)) {
      input = JSON.stringify(input);
    }

    return Jose.JWE
      .createEncrypt(options, key)
      .update(input)
      .final();
  }


  // Create decryption (JWE). Resolved with
  // plaintext field of a result.
  //
  // @return Promise

  function decrypt(input, key) {
    return Jose.JWE
      .createDecrypt(key)
      .decrypt(input)
      .then(function (result) {
        return result.plaintext.toString();
      });
  }


  // Create a jsonwebtoken and sign it using
  // secret key ID.
  // Algorithm used 'HS256'.
  //
  // @return String

  function createJWT(options, kid) {
    var header = {alg: 'HS256', typ: 'JWT'};

    var claims = {
      iss: options.iss,
      aud: options.aud,
      sub: options.sub,
      jti: options.jti || generateId(),
      data: options.data
    };

    return JWT.jws.JWS
      .sign('HS256', JSON.stringify(header), JSON.stringify(claims), kid);
  }


  // Verify signature and validate a jsonwebtoken.
  // Algorithm used 'HS256'.
  //
  // @return Boolean

  function verifyJWT(input, kid, validateOptions) {
    validateOptions = validateOptions || {};
    validateOptions.alg = ['HS256'];

    return JWT.jws.JWS.verifyJWT(input, kid, validateOptions);
  }


  // Split JWT into header and payload, decode them.
  //
  // @return Object

  function decodeJWT(input) {
    input = input.split('.');

    return {
      header: JSON.parse(decode(input[0])),
      payload: JSON.parse(decode(input[1]))
    };
  }


  // Syntax sugar for encrypting header.
  //
  // @return Promise

  function encryptHeader(header, secretKey) {
    return encrypt(header, secretKey, { format: 'compact' });
  }


  // Syntax sugar for encrypting payload.
  // Create jwt first, then encrypt.
  //
  // @return Promise

  function encryptPayload(payload, secretKey, options) {
    var jwt = createJWT({
      iss: options.iss,
      aud: options.aud,
      sub: options.sub,
      data: payload
    }, secretKey.kid);

    return encrypt(jwt, secretKey);
  }


  // Syntax sugar for decrypting payload.
  // Decrypt the payload first, then verify
  // jsonwebtoken and decode it.
  //
  // @return Promise

  function decryptPayload(payload, secretKey, options) {
    return decrypt(payload, secretKey).then(function (jwt) {
      var isValid = verifyJWT(jwt, secretKey.kid, {
        iss: [options.iss],
        aud: [options.aud],
        sub: [options.sub]
      });

      if (isValid) {
        return decodeJWT(jwt).payload.data;
      } else {
        throw new Error('Unable to verify jsonwebtoken');
      }
    });
  }


  function decode(input) {
    return Jose.util.base64url.decode(input, 'utf8');
  }


  // Plugin API
  var EVTHubPlugin = {

    version: version,

    settings: defaultSettings,

    // Setup new settings.
    setup: function (customSettings) {

      function validateSettings(settings) {

        // Secure mode requires hubId to be defined, as well as
        // jsrsasign and node-jose(-browserified) to be installed.
        if (settings.secure && !settings.hubId) {

          console.warn('[EvrythngJS Hub] hubId option required for enabling secure mode');
          settings.secure = false;

        } else if (settings.secure && settings.hubId && !(JWT && Jose)) {

          console.warn('[EvrythngJS Hub] jsrsasign and node-jose(-browserified) required for enabling secure mode');
          settings.secure = false;

        }

        // TODO deprecate
        if (settings.apiUrl) {
          console.warn('[EvrythngJS Hub] apiUrl option has been deprecated. Use httpApiUrl instead.');
          settings.httpApiUrl = settings.apiUrl;
          delete settings.apiUrl;
        }

        return settings;
      }

      if (_isObject(customSettings)) {

        // Override default settings with new ones
        for (var i in customSettings) {
          if (customSettings.hasOwnProperty(i)) {
            this.settings[i] = customSettings[i];
          }
        }

      } else {
        throw new TypeError('Setup should be called with an options object.');
      }

      return validateSettings(this.settings);
    },

    install: function (EVT, Resource) {
      var $this = this,
        pubSubPlugin = MQTT || WS,
        securePromise, secretKey,
        encryptedApiKeyPromise;

      var original = {
        api: EVT.api,
        subscribe: Resource.prototype.subscribe,
        publish: Resource.prototype.publish
      };

      // TODO-EUGENE Fix this
      EVT.setup({
        geolocation: !$this.settings.secure
      });

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

          // Secure mode disabled. Try local first, then remote. Simple.
          if (!$this.settings.secure) {

            return original.api.apply(EVT, args).catch(function (err) {

              if (pubSubPlugin && err && err.cancelled) {
                return;
              }

              // Use original settings.
              switchToRemote(options);

              return original.api.apply(EVT, args);

            });

          } else {

            if (!securePromise) {
              securePromise = getSecretKey(options.authorization)
                .then(function (key) {
                  secretKey = key;
                });
            }

            return securePromise.then(function () {
              return trySecureRequest(args);
            });

          }

        } else {

          // Normal request.
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

          if (!$this.settings.secure) {
            return original[method].apply($resource, args).catch(function (err) {

              // Fallback to remote endpoint.
              pubSubPlugin.setup({
                apiUrl: remoteApiUrl
              });

              return original[method].apply($resource, args);
            });

          } else {

            if (!securePromise) {
              securePromise = getSecretKey($resource.scope.apiKey)
                .then(function (key) {
                  secretKey = key;
                });
            }

            return securePromise.then(function () {
              var apiKey = $resource.scope.apiKey;

              if (!$resource.scope.encryptedApiKey) {
                encryptedApiKeyPromise = encrypt(apiKey, secretKey, { format: 'compact' })
                  .then(function (encryptedApiKey) {
                    $resource.scope.encryptedApiKey = encryptedApiKey;
                  });
              }

              return encryptedApiKeyPromise.then(function () {
                if (method === 'subscribe') {
                  return trySecureSubscribe($resource, args, remoteApiUrl);
                } else {
                  return trySecurePublish($resource, args, remoteApiUrl);
                }
              });
            });
          }

        };
      }

      function trySecureRequest(args) {
        var options = args[0],
          cachedSuccessCb = args[1],
          cachedHeader = options.authorization,
          cachedPayload = options.data;

        return buildEncryptedRequest(options).then(function (encrypted) {
          options.authorization = encrypted[0];

          if (options.data) {
            options.data = encrypted[1];
          }

          // Try local encrypted request.
          args[1] = undefined;
          return original.api.apply(EVT, args);

        }).then(function (response) {

          if (response) {
            return decryptPayload(response, secretKey, {
              aud: cachedHeader,
              iss: $this.settings.hubId,
              sub: options.url
            }).then(function (decrypted) {
              if (cachedSuccessCb) {
                cachedSuccessCb(decrypted);
              } else {
                return decrypted;
              }
            });
          }

        }).catch(function (err) {

          // Use original settings.
          switchToRemote(options);

          options.authorization = cachedHeader;
          args[1] = cachedSuccessCb;

          if (options.data) {
            options.data = cachedPayload;
          }

          return original.api.apply(EVT, args);
        });
      }

      function buildEncryptedRequest(options) {
        var promises = [];

        promises.push(encryptHeader(options.authorization, secretKey));

        // Create JWT from a payload JSON, then encrypt.
        if (options.data) {
          promises.push(encryptPayload(options.data, secretKey, {
            aud: $this.settings.hubId,
            iss: options.authorization,
            sub: options.url
          }));
        }

        return Promise.all(promises);
      }

      function trySecureSubscribe(resource, args, remoteApiUrl) {
        var msgCallback = args[0],
          msgCallbackUpdated,
          cachedApiKey = resource.scope.apiKey;

        msgCallbackUpdated = function (msg) {
          return decryptPayload(msg, secretKey, {
            aud: cachedApiKey,
            iss: $this.settings.hubId,
            sub: resource.path
          }).then(function (decryptedMsg) {
            return msgCallback(resource.parse(decryptedMsg));
          });
        };

        resource.scope.apiKey = resource.scope.encryptedApiKey;
        args[0] = msgCallbackUpdated;

        var subscribePromise = original['subscribe'].apply(resource, args);

        resource.scope.apiKey = cachedApiKey;

        return subscribePromise
          .catch(function () {

            // Fallback to remote endpoint.
            pubSubPlugin.setup({
              apiUrl: remoteApiUrl
            });

            // User original.
            args[0] = msgCallback;

            return original['subscribe'].apply(resource, args);

          });
      }

      function trySecurePublish(resource, args, remoteApiUrl) {
        var data = args[0],
          cachedApiMethod = EVT.api,
          cachedApiKey = resource.scope.apiKey;

          // Catch the interceptor added by MQTT/WS plugin and
          // encrypt the message before publishing.
          EVT.api = encryptBeforePublish(resource, cachedApiKey);

          var publishPromise = original['publish'].apply(resource, args);

          EVT.api = cachedApiMethod;

          return publishPromise.catch(function () {

            // Fallback to remote endpoint.
            pubSubPlugin.setup({
              apiUrl: remoteApiUrl
            });

            // User original.
            args[0] = data;

            // EVT.api gets called from MQTT/WS plugin. At this point EVT.api
            // is alreay overriden by localApi, so we quickly need to restore
            // original value here.
            EVT.api = original.api;

            var publishPromise = original['publish'].apply(resource, args);

            // Set back to what it was before.
            EVT.api = cachedApiMethod;

            return publishPromise;

          });
      }

      function switchToRemote(options) {
        delete options.apiUrl;
        delete options.timeout;
      }

      function getSecretKey(apiKey) {
        return loadThng($this.settings.hubId, apiKey).then(function (thng) {
          if (hasSecretKey(thng)) {
            return initSecretKey(thng.customFields.key);
          }
        });
      }

      function loadThng(id, apiKey) {
        var requestOptions = {
          url: '/thngs/' + id,
          authorization: apiKey
        };

        return original.api(requestOptions);
      }

      function hasSecretKey(entity) {
        return entity && entity.customFields && _isObject(entity.customFields.key);
      }

      function encryptBeforePublish(resource, cachedApiKey) {
        return function (req) {
          var publishInterceptor = req.interceptors[0].request;

          var cancel = function () {
            return;
          };

          return encryptPayload(req.data, secretKey, {
            aud: $this.settings.hubId,
            iss: cachedApiKey,
            sub: req.url
          }).then(function (encrypted) {

            req.data = encrypted;
            resource.scope.apiKey = resource.scope.encryptedApiKey;

            publishInterceptor(req, cancel);

            resource.scope.apiKey = cachedApiKey;
          });
        };
      }

      if ($this.settings.secure) {
        $this.utils.getSecretKey = getSecretKey;
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
      encryptHeader: encryptHeader,
      encryptPayload: encryptPayload,
      decryptPayload: decryptPayload
    };
  }

  // Modules that this plugin requires. Injected into the install method.
  EVTHubPlugin.$inject = ['core', 'resource'];

  return EVTHubPlugin;

}));
