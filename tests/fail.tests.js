const test = require('../test')

test('no assertions', () => true)

test('parseInt with the wrong base', ({ expect }) => {
  const two = '2'
  expect(parseInt(two, 2)).toBe(2)
})
