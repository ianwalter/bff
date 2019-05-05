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
import { getSnapshotState } from './lib'

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

      // Update expect's state with the snapshot state and the test name.
      expect.setState({
        assertionCalls: 0,
        suppressedErrors: [],
        snapshotState: getSnapshotState(file, context.updateSnapshot),
        currentTestName: test.name
      })

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

    })
  }
})
