import { oneLine } from 'common-tags'

function handleTestArgs (tests, name, tags, test = {}) {
  const testFn = tags.pop()
  const key = oneLine(name)
  Object.assign(test, { key, name: key, testFn, tags })
  if (testFn && typeof testFn === 'function') {
    tests.push(test)
  } else {
    return fn => {
      Object.assign(test, { testFn: fn, tags: testFn ? [...tags, testFn] : [] })
      tests.push(test)
    }
  }
}

function test (name, ...tags) {
  handleTestArgs(this.tests, name, tags)
}

test.tests = []

test.skip = function skip (name, ...tags) {
  handleTestArgs(this.tests, name, tags, { skip: true })
}

test.only = function only (name, ...tags) {
  handleTestArgs(this.tests, name, tags, { only: true })
}

export { test }
