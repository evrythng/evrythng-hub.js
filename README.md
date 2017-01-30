# evrythng-hub.js [![Build Status](https://travis-ci.org/evrythng/evrythng-hub.js.svg?branch=master)](https://travis-ci.org/evrythng/evrythng-hub.js)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](http://standardjs.com)

## Getting started

### Install evrythng-hub.js using npm.

```javascript
npm install evrythng-hub
```

Then require it into any module.

```javascript
const EVT = require('evrythng')
const EVTHub = require('evrythng-hub')

EVT.use(EVTHub)

/* ... Init app using EVT.js ... */

app.scan().then(match => {
  app.redirect(match.redirections[0].redirectUrl)
})
```

### Browser

To use evrythng-hub.js from a browser, download `dist/evrythng-hub.min.js` or use a CDN such as CDNJS or jsDelivr.

Then, add it as a script tag to your page:

```html
<script src="evrythng.min.js"></script>
<script src="evrythng-hub.min.js"></script>
<script>
    EVT.use(EVTHub)

    /* ... Init app using EVT.js ... */

    app.scan().then(match => {
      app.redirect(match.redirections[0].redirectUrl)
    })
</script>
```

Or use an AMD loader (such as RequireJS):

```javascript
require(['./evrythng.min.js', './evrythng-hub.min.js'], (EVT, EVTHub) => {
    EVT.use(EVTHub)

    /* ... Init app using EVT.js ... */

    app.scan().then(match => {
      app.redirect(match.redirections[0].redirectUrl)
    })
})
```

If you're using browserify, the `evrythng-hub` npm module also works from the browser.
