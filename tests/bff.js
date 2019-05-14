const { test, run } = require('..')

test('bff', async ({ expect }) => {
  const config = { timeout: 5000, plugins: ['tests/helpers/plugin.js'] }
  const result = await run(config)
  expect(result.passed).toBe(15)
  expect(result.failed).toBe(8)
  expect(result.skipped).toBe(2)
})
