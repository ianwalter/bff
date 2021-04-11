import { test } from '../index.js'

test.skip('skip no assertions', () => true)

test.skip('skip with test specified after name')(t => t.fail())

test.skip('skip with no test function')

test('skip in-test', t => {
  t.skip('reasons')
  throw new Error('This should not be executed')
})
