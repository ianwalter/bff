const { test, run } = require('..')

test('bff', async ({ expect }) => {
  const config = { timeout: 5000, plugins: ['tests/helpers/plugin.js'] }
  const result = await run(config)
  expect(result.filesRegistered).toBe(5)
  expect(result.testsRegistered).toBe(26)
  expect(result.testsRun).toBe(26)
  expect(result.passed.length).toBe(15)
  expect(result.passed.sort()).toMatchSnapshot()
  expect(result.failed.length).toBe(8)
  expect(result.failed.sort()).toMatchSnapshot()
  expect(result.skipped.length).toBe(2)
  expect(result.skipped.sort()).toMatchSnapshot()
})
