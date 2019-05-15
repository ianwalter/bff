const { utils } = require('jest-snapshot')

module.exports = async function runTest (testContext, testFn) {
  const pTimeout = require('p-timeout')
  try {
    // Wrap the test function in a timeout Promise and run it.
    const promise = new Promise(async (resolve, reject) => {
      try {
        await testFn(testContext)
        resolve()
      } catch (err) {
        reject(err)
      }
    })
    await pTimeout(promise, testContext.timeout)

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

    // Deconstruct the snapshot state into a POJO so that it can be sent back to
    // the main thread via sendMessage.
    const { snapshotState } = testContext.expect.getState()
    if (snapshotState && (snapshotState.added || snapshotState.updated)) {
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
  } catch (err) {
    testContext.result.failed = err

    // Delete the matcher result property of the error since it can't be
    // sent over postMessage.
    delete testContext.result.failed.matcherResult
  }
}
