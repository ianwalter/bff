const { test } = require('..')

test.warn('warn fail', t => t.fail())

test.warn('warn pass', t => t.pass())
