import expect from 'expect'
import jestSnapshot from 'jest-snapshot'
import clone from '@ianwalter/clone'
import { Subpub } from '@ianwalter/subpub'
import sleep from '@ianwalter/sleep'

const {
  SnapshotState,
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot
} = jestSnapshot

export default function enhanceTestContext (testContext) {
  // Add a Subpub instance to the testContext so it can listen for the 'done'
  // event.
  testContext.sp = new Subpub()

  // Extend expect with jest-snapshot to allow snapshot testing.
  expect.extend({
    toMatchInlineSnapshot,
    toMatchSnapshot,
    toThrowErrorMatchingInlineSnapshot,
    toThrowErrorMatchingSnapshot
  })
  expect.addSnapshotSerializer = addSerializer

  //
  expect.extend({
    toMatchSnapshotLines (received) {
      let message
      try {
        // Clone the initial matchers state in case it needs to be reset later.
        const initialState = clone(expect.getState())

        // Run the snapshot matcher.
        expect(received).toMatchSnapshot()

        // Get the matchers state again now that the snapshot matcher has
        // executed.
        const state = expect.getState()
        if (state.suppressedErrors.length) {
          // Get the expected string content from the snapshot matcher error.
          let expected = state.suppressedErrors[0].matcherResult.expected
          expected = expected.substring(1, expected.length - 1).split('\n')

          // Reset the matchers state so that there isn't duplicate match
          // results.
          expect.setState(initialState)

          // Expect the lines in the received text to match the lines in the
          // snapshot text without requiring the lines to be in order.
          expect(received.split('\n').sort()).toEqual(expected.sort())
        }

        // If the toEqual assertion didn't throw an error, the matcher passed.
        return { pass: true }
      } catch (err) {
        message = () => err.message
      }

      return { pass: false, message }
    }
  })

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
  Object.assign(testContext, sleep)

  // Allow skipping a test from within the test with t.skip. Throw an error so
  // execution stops right away.
  testContext.skip = (why = 'in-test skip') => {
    testContext.result = { skipped: why }
    throw new Error(why)
  }

  // Allow marking a test with a warning from within the test with t.warn. Throw
  // an error so execution stops right away.
  testContext.warn = (why = 'in-test warn') => {
    testContext.result = { warned: why }
    throw new Error(why)
  }
}
