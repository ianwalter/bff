import { test } from '../index.js'

test.warn('warn fail', t => t.fail())

test.warn('warn pass', t => t.pass())

test('warn in-test', t => t.warn())
