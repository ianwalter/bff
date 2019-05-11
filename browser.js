import { oneLine } from 'common-tags'

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
  try {
    const { testFn } = window.tests[test]
    await testFn()
  } catch (err) {
    // TODO:
  }
}

export { test }
