const { test } = require('..')

test.only('only', ({ pass }) => pass())

test('skip via only', ({ expect }) => expect(1).toBe('1'))

test.only('only with test specified after name')(({ pass }) => pass())
