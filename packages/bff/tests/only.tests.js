import { test } from '../index.js'

test.only('only', t => t.pass())

test('skip via only', t => t.expect(1).toBe('1'))

test.only('only with test specified after name')(t => t.pass())
