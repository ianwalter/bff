import workerpool from 'workerpool'
import expect from 'expect'
import {
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  utils
} from 'jest-snapshot'
import pTimeout from 'p-timeout'
import { resetExpectState } from './lib'

// Extend the expect with jest-snapshot to allow snapshot testing.
expect.extend({
  toMatchInlineSnapshot,
  toMatchSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  toThrowErrorMatchingSnapshot
})
expect.addSnapshotSerializer = addSerializer

workerpool.worker({
  run (test, file, context) {
    console.debug('Test worker', test.name, '(Puppeteer)')

    return new Promise(async (resolve, reject) => {


      const tests = await import(file)
      const { testFn } = tests[test.key]

      try {
        // TODO:
        resetExpectState(expect, test, file, context.updateSnapshot)

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        const promise = new Promise(async (resolve, reject) => {
          try {
            await testFn(testContext)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
        await pTimeout(promise, context.timeout)

        // Extract expect's state after running the test.
        const { suppressedErrors, assertionCalls } = expect.getState()

        // If there were no assertions executed, fail the test.
        if (!testContext.result.passed && assertionCalls === 0) {
          throw new Error('no assertions made')
        }

        // If expect has a suppressed error (e.g. a snapshot did not match)
        // then throw the error so that the test can be marked as having failed.
        if (suppressedErrors.length) {
          throw suppressedErrors[0]
        }

        const { snapshotState } = expect.getState()
        if (snapshotState.added || snapshotState.updated) {
          testContext.result = {
            counters: Array.from(snapshotState._counters),
            snapshots: {},
            added: snapshotState.added,
            updated: snapshotState.updated
          }
          for (let i = snapshotState._counters.get(test.name); i > 0; i--) {
            const key = utils.testNameToKey(test.name, i)
            testContext.result.snapshots[key] = snapshotState._snapshotData[key]
          }
        }
      } catch (err) {
        testContext.result.failed = err

        // Delete the matcher result property of the error since it can't be
        // sent over postMessage.
        delete testContext.result.failed.matcherResult
      }

      resolve(testContext.result)
    })
  }
})
