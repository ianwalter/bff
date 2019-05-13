import { oneLine } from 'common-tags'
import createTestContext from './lib/createTestContext'
import runTest from './lib/runTest'

window.testMap = {}

function handleTestArgs (name, tags, test = {}) {
  const testFn = tags.pop()
  const key = oneLine(name)
  Object.assign(test, { key, name: key, testFn, tags })
  if (testFn && typeof testFn === 'function') {
    window.testMap[test.key] = test
  } else {
    return fn => {
      Object.assign(test, { testFn: fn, tags: testFn ? [...tags, testFn] : [] })
      window.testMap[test.key] = test
    }
  }
}

function test (name, ...tags) {
  handleTestArgs(name, tags)
}

test.skip = function skip (name, ...tags) {
  handleTestArgs(name, tags, { skip: true })
}

test.only = function only (name, ...tags) {
  handleTestArgs(name, tags, { only: true })
}

window.runTests = async function (file, test, context) {
  const testContext = createTestContext(file, test, context)

  // TODO:
  const { testFn } = window.tests[test]

  // TODO:
  await runTest(testContext, testFn, context.timeout)

  // TODO:
  return context.testContext.result
}

export { test }
