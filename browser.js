import { oneLine } from 'common-tags'
import expect from 'expect'
import {
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  utils
} from 'jest-snapshot'
import workerpool from 'workerpool'
import pTimeout from 'p-timeout'

// Extend the expect with jest-snapshot to allow snapshot testing.
expect.extend({
  toMatchInlineSnapshot,
  toMatchSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  toThrowErrorMatchingSnapshot
})
expect.addSnapshotSerializer = addSerializer

const tests = {}

async function run (context) {
  const results = []

  // Create the context object that provides data and utilities to tests.
  Object.assign(context.testContext, {
    expect,
    fail (reason = 'manual failure') {
      throw new Error(reason)
    },
    pass (reason = 'manual pass') {
      context.testContext.result.passed = reason
    }
  })

  async function runTest (test) {
    // Update expect's state with the snapshot state and the test name.
    expect.setState({
      assertionCalls: 0,
      suppressedErrors: [],
      // snapshotState: getSnapshotState(file, context.updateSnapshot),
      currentTestName: test.name
    })
  }

  return results
}

function handleTestArgs (name, tags, test = {}) {
  const testFn = tags.pop()
  if (testFn && typeof testFn === 'function') {
    Object.assign(test, { testFn, tags })
    tests[oneLine(name)] = test
    return test
  } else {
    return fn => {
      Object.assign(test, { testFn: fn, tags: testFn ? [...tags, testFn] : [] })
      tests[oneLine(name)] = test
      return test
    }
  }
}

function test (name, ...tags) {
  return handleTestArgs(name, tags)
}

test.skip = function skip (name, ...tags) {
  return handleTestArgs(name, tags, { skip: true })
}

test.only = function only (name, ...tags) {
  return handleTestArgs(name, tags, { only: true })
}

export { test, run }
