const { test } = require('..')

test('console.log', t => {
  t.expect('ok').toBeTruthy()
  console.log('x'.repeat(5e6))
})
