const { test, run } = require('..')

const config = { timeout: 5000, plugins: ['tests/helpers/plugin.js'] }
const toName = ({ name, err }) => name + (err ? `: ${err}` : '')

test('bff', async ({ expect }) => {
  const result = await run(config)
  expect(result.filesRegistered).toBe(5)
  expect(result.testsRegistered).toBe(26)
  expect(result.testsRun).toBe(26)
  expect(result.passed.length).toBe(15)
  expect(result.passed.map(toName).sort()).toMatchSnapshot()
  expect(result.failed.length).toBe(8)
  expect(result.failed.map(toName).sort()).toMatchSnapshot()
  expect(result.skipped.length).toBe(2)
  expect(result.skipped.map(toName).sort()).toMatchSnapshot()
})

test('bff --failFast', async ({ expect }) => {
  const result = await run({ ...config, failFast: true })
  expect(result.testsRegistered).toBeGreaterThan(0)
  expect(result.testsRun).toBeGreaterThan(0)
  expect(result.failed.length).toBe(1)
})
