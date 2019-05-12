const expect = require('expect')
const {
  SnapshotState,
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  utils
} = require('jest-snapshot')

module.exports = async function runTest (file, test, context) {
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
  const testContext = context.testContext = {
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

  const pTimeout = require('p-timeout')
  try {
    // TODO: simplify?
    // Wrap the test function in a timeout Promise and run it.
    const promise = new Promise(async (resolve, reject) => {
      try {
        await test.testFn(testContext)
        resolve()
      } catch (err) {
        reject(err)
      }
    })
    await pTimeout(promise, context.timeout)

    // Extract expect's state after running the test.
    const { suppressedErrors, assertionCalls } = testContext.expect.getState()

    // If there were no assertions made, fail the test.
    if (!testContext.result.passed && assertionCalls === 0) {
      throw new Error('no assertions made')
    }

    // If expect has a suppressed error (e.g. a snapshot did not match)
    // then throw the error so that the test can be marked as having failed.
    if (suppressedErrors.length) {
      throw suppressedErrors[0]
    }

    // TODO: comment.
    const { snapshotState } = testContext.expect.getState()
    if (snapshotState.added || snapshotState.updated) {
      testContext.result = {
        counters: Array.from(snapshotState._counters),
        snapshots: {},
        added: snapshotState.added,
        updated: snapshotState.updated
      }
      for (let i = snapshotState._counters.get(testContext.name); i > 0; i--) {
        const key = utils.testNameToKey(testContext.key, i)
        testContext.result.snapshots[key] = snapshotState._snapshotData[key]
      }
    }

    testContext.result.passed = true
  } catch (err) {
    testContext.result.failed = err

    // Delete the matcher result property of the error since it can't be
    // sent over postMessage.
    delete testContext.result.failed.matcherResult
  }
}
