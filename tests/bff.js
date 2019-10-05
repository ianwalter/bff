const { test, run } = require('..')

const config = { timeout: 5000, plugins: ['tests/helpers/plugin.js'] }
const toName = ({ name, err }) => name + (err ? `: ${err}` : '')

test('bff', async ({ expect }) => {
  const result = await run(config)
  expect(result.filesRegistered).toBe(5)
  expect(result.testsRegistered).toBe(28)
  expect(result.testsRun).toBe(28)
  expect(result.passed.length).toBe(14)
  expect(result.passed.map(toName).sort()).toMatchSnapshot()
  expect(result.failed.length).toBe(9)
  expect(result.failed.map(toName).sort()).toMatchSnapshot()
  expect(result.warnings.length).toBe(1)
  expect(result.warnings.map(toName).sort()).toMatchSnapshot()
  expect(result.skipped.length).toBe(4)
  expect(result.skipped.map(toName).sort()).toMatchSnapshot()
})

test('bff --failFast', async ({ expect }) => {
  const result = await run({ ...config, failFast: true })
  expect(result.testsRegistered).toBeGreaterThan(0)
  expect(result.testsRun).toBeGreaterThan(0)
  expect(result.failed.length).toBe(1)
})

test('bff --tags qa', async ({ expect }) => {
  const result = await run({ tags: 'qa' })
  expect(result.testsRegistered).toBe(2)
  expect(result.testsRun).toBe(2)
  expect(result.passed.length).toBe(1)
  expect(result.failed.length).toBe(1)
})

test('bff --tags dev --tags qa --match every', async ({ expect }) => {
  const result = await run({ tags: ['dev', 'qa'], match: 'every' })
  expect(result.testsRegistered).toBe(1)
  expect(result.testsRun).toBe(1)
  expect(result.passed.length).toBe(0)
  expect(result.failed.length).toBe(1)
})

test('uncaught exception in test file', async ({ expect }) => {
  const result = await run({ tests: ['tests/uncaught.js'] })
  expect(result.err instanceof Error).toBe(true)
  expect(result.err.message).toContain('Cannot find module')
})
