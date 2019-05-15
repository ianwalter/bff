const expect = require('expect')
const {
  SnapshotState,
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot
} = require('jest-snapshot')

module.exports = function createTestContext (file, test, updateSnapshot) {
  // Extend the expect with jest-snapshot to allow snapshot testing.
  expect.extend({
    toMatchInlineSnapshot,
    toMatchSnapshot,
    toThrowErrorMatchingInlineSnapshot,
    toThrowErrorMatchingSnapshot
  })
  expect.addSnapshotSerializer = addSerializer

  // Update expect's state with the snapshot state and the test name.
  expect.setState({
    assertionCalls: 0,
    suppressedErrors: [],
    snapshotState: new SnapshotState(file.snapshotPath, { updateSnapshot }),
    currentTestName: test.key
  })

  // Create the context object that provides data and utilities to tests.
  const testContext = {
    ...file,
    ...test,
    expect,
    result: {},
    fail (reason = 'manual failure') {
      throw new Error(reason)
    },
    pass (reason = 'manual pass') {
      testContext.result.passed = reason
    }
  }

  return testContext
}
