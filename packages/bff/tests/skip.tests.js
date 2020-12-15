import { test } from '../index.js'

test.skip('skip no assertions', () => true)

test.skip('skip with test specified after name')(t => t.fail())

test.skip('skip with no test function')
