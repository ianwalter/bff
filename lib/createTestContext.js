const expect = require('expect')
const {
  SnapshotState,
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot
} = require('jest-snapshot')

module.exports = function creatTestContext (file, test, context) {
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
    snapshotState: new SnapshotState(
      file.snapshotPath,
      { updateSnapshot: context.updateSnapshot }
    ),
    currentTestName: test.key
  })

  // Create the context object that provides data and utilities to tests.
  context.testContext = {
    ...file,
    ...test,
    expect,
    result: {},
    fail (reason = 'manual failure') {
      throw new Error(reason)
    },
    pass (reason = 'manual pass') {
      context.testContext.result.passed = reason
    }
  }

  return context.testContext
}
