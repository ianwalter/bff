const { test } = require('..')

test.warn('warn fail', ({ fail }) => fail())

test.warn('warn pass', ({ pass }) => pass())
