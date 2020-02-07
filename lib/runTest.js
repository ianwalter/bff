const { utils } = require('jest-snapshot')
const cloneable = require('@ianwalter/cloneable')

module.exports = async function runTest (testContext, testFn) {
  function done () {
    testContext.sp.pub('done')
  }
  done.pass = function (why) {
    testContext.pass(why)
    done()
  }
  done.fail = function (why = 'manual failure') {
    testContext.failed = new Error(why)
    done()
  }

  try {
    // Run the test in parallel with a timeout promise that will throw an error
    // if the specified timeout is reached.
    await Promise.race([
      new Promise((resolve, reject) => testContext.sp.sub('done', resolve)),
      new Promise((resolve, reject) => {
        try {
          const result = testFn(testContext, done)
          if (result && typeof result === 'object' && result.then) {
            result.then(resolve).catch(reject)
          } else if (testFn.length < 2) {
            resolve()
          }
        } catch (err) {
          reject(err)
        }
      }),
      new Promise((resolve, reject) => setTimeout(
        reject,
        testContext.timeout,
        new Error(`test reached timeout of ${testContext.timeout} milliseconds`)
      ))
    ])

    // Fail the test even though the error thrown by the manual fail method was
    // caught.
    if (testContext.failed) {
      throw testContext.failed
    }

    // Extract expect's state after running the test.
    const { suppressedErrors, assertionCalls } = testContext.expect.getState()

    // If expect has a suppressed error (e.g. a snapshot did not match)
    // then throw the error so that the test can be marked as having failed.
    if (suppressedErrors.length) {
      throw suppressedErrors[0]
    }

    // If there were no assertions made, fail the test.
    if (!testContext.result.passed && assertionCalls === 0) {
      throw new Error('no assertions made')
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
    // Use cloneable to convert the error into an object that can be passed from
    // the test worker to the main thread via postMessage by removing all
    // methods.
    testContext.result.failed = cloneable(err)
  }
}
