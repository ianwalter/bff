const { test } = require('..')

test('console.log', ({ expect }) => {
  expect('ok').toBeTruthy()
  console.log('x'.repeat(5e6))
})
