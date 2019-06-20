const expect = require('expect')
const {
  SnapshotState,
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot
} = require('jest-snapshot')

module.exports = function enhanceTestContext (testContext) {
  // Extend expect with jest-snapshot to allow snapshot testing.
  expect.extend({
    toMatchInlineSnapshot,
    toMatchSnapshot,
    toThrowErrorMatchingInlineSnapshot,
    toThrowErrorMatchingSnapshot
  })
  expect.addSnapshotSerializer = addSerializer

  // Update/reset expect's state with the snapshot state and the test name.
  expect.setState({
    assertionCalls: 0,
    suppressedErrors: [],
    snapshotState: new SnapshotState(testContext.snapshotPath, testContext),
    currentTestName: testContext.key
  })

  // Add utilities to the testContext object.
  testContext.expect = expect
  testContext.fail = (why = 'manual failure') => {
    testContext.failed = new Error(why)
    throw testContext.failed
  }
  testContext.pass = (why = 'manual pass') => (testContext.result.passed = why)
  testContext.sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
}
