const { test } = require('..')

test('no assertions', () => true)

test('parseInt with the wrong base', ({ expect }) => {
  const two = '2'
  expect(parseInt(two, 2)).toBe(2)
})

test('manual fail', ({ fail }) => fail())

test('afterEach', ({ fail }) => fail())
