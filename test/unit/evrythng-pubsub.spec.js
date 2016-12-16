/* eslint-env jasmine */
import * as EVTHub from '../../src/evrythng-hub'

describe('EVTHub', () => {
  it('should contain version', () => {
    expect(EVTHub.version).toBeDefined()
  })

  it('should contain correct version', () => {
    expect(EVTHub.version).toBe('2.0.0')
  })
})
