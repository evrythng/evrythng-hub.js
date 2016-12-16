(function (root, factory) {
  /* global define */
  if (typeof define === 'function' && define.amd) {
    define(['evrythng', 'evrythng-hub'], factory)
  } else if (typeof module === 'object' && module.exports) {
    factory(require('evrythng'), require('../../dist/evrythng-hub'))
  } else {
    factory(root.EVT, root.EVTHub)
  }
}(this, function factory (EVT, EVTHub) {
  /* eslint-env jasmine */

  describe('EVTHub Distribution', () => {
    it('should exist', () => {
      expect(EVTHub).toBeDefined()
    })
  })
}))

