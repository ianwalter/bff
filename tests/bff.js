const { test, run } = require('..')

test('bff', async ({ expect }) => {
  const result = await run({ timeout: 5000 })
  expect(result.passed).toBe(15)
  expect(result.failed).toBe(8)
  expect(result.skipped).toBe(2)
})
