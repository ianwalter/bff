const { join, dirname, basename, resolve } = require('path')
const { SnapshotState } = require('jest-snapshot')


function toHookRun (hookName, context) {
  return file => async () => {
    let plugin
    try {
      plugin = require(file)
    } catch (err) {
      // Don't need to handle this error.
    }
    plugin = plugin || require(resolve(file))
    const hook = plugin[hookName]
    if (hook) {
      await hook(context)
    }
  }
}

function createTestContext (expect, test, file, context) {
  // Create the context object that provides data and utilities to tests.
  context.testContext = {
    ...test,
    file,
    result: {},
    expect,
    fail (reason = 'manual failure') {
      throw new Error(reason)
    },
    pass (reason = 'manual pass') {
      context.testContext.result.passed = reason
    }
  }

  // Initialize the snapshot state with a path to the snapshot file and
  // the updateSnapshot setting.
  const snapshotsDir = join(dirname(file), 'snapshots')
  const snapshotFilename = basename(file).replace('.js', '.snap')
  const snapshotPath = join(snapshotsDir, snapshotFilename)
  const updateSnapshot = context.updateSnapshot

  // Update expect's state with the snapshot state and the test name.
  expect.setState({
    assertionCalls: 0,
    suppressedErrors: [],
    snapshotState: new SnapshotState(snapshotPath, { updateSnapshot }),
    currentTestName: test.name
  })

  return context.testContext
}

async function runTest (test, testContext, timeout) {
  const pTimeout = require('p-timeout')
  try {
    // Perform the given test within the test file and make the expect
    // assertion library available to it.
    const promise = new Promise(async (resolve, reject) => {
      try {
        await test.testFn(testContext)
        resolve()
      } catch (err) {
        reject(err)
      }
    })
    await pTimeout(promise, timeout)

    // Extract expect's state after running the test.
    const { suppressedErrors, assertionCalls } = testContext.expect.getState()

    // If there were no assertions executed, fail the test.
    if (!testContext.result.passed && assertionCalls === 0) {
      throw new Error('no assertions made')
    }

    // If expect has a suppressed error (e.g. a snapshot did not match)
    // then throw the error so that the test can be marked as having failed.
    if (suppressedErrors.length) {
      throw suppressedErrors[0]
    }

    const { snapshotState } = testContext.expect.getState()
    if (snapshotState.added || snapshotState.updated) {
      testContext.result = {
        counters: Array.from(snapshotState._counters),
        snapshots: {},
        added: snapshotState.added,
        updated: snapshotState.updated
      }
      for (let i = snapshotState._counters.get(test.name); i > 0; i--) {
        const key = utils.testNameToKey(test.name, i) // TODO:
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

module.exports = { toHookRun, createTestContext, runTest }
