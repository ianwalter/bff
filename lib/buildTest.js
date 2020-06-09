const callsites = require('callsites')
const { oneLine } = require('common-tags')

module.exports = function buildTest (name, test = {}, tags, extraLines = 1) {
  // Add the test line number to the object so it can be shown in verbose mode.
  test.lineNumber = callsites()[extraLines].getLineNumber()

  const testFn = tags.pop()
  const key = oneLine(name)
  return Object.assign({ key, name: key }, test, { fn: testFn, tags })
}
