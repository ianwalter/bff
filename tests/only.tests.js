const { test } = require('..')

test.only('only', ({ pass }) => pass())

test('strict equality fails', ({ expect }) => expect(1).toBe('1'))
