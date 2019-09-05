const { test, run } = require('..')

const config = { timeout: 5000, unordered: true }
const plugins = ['tests/helpers/plugin.js']
const toName = ({ name, err }) => name + (err ? `: ${err}` : '')

test.only('bff', async ({ expect }) => {
  const result = await run({ ...config, plugins })
  expect(result.filesRegistered).toBe(4)
  expect(result.testsRegistered).toBe(26)
  expect(result.testsRun).toBe(26)
  expect(result.passed.length).toBe(13)
  expect(result.passed.map(toName).sort()).toMatchSnapshot()
  expect(result.failed.length).toBe(9)
  expect(result.failed.map(toName).sort()).toMatchSnapshot()
  expect(result.skipped.length).toBe(4)
  expect(result.skipped.map(toName).sort()).toMatchSnapshot()
})

test('bff --failFast', async ({ expect }) => {
  const result = await run({ ...config, plugins, failFast: true })
  expect(result.testsRegistered).toBeGreaterThan(0)
  expect(result.testsRun).toBeGreaterThan(0)
  expect(result.failed.length).toBe(1)
})

test('bff --tags qa', async ({ expect }) => {
  const result = await run({ ...config, tags: 'qa' })
  expect(result.testsRegistered).toBe(2)
  expect(result.testsRun).toBe(2)
  expect(result.passed.length).toBe(1)
  expect(result.failed.length).toBe(1)
})

test('bff --tags dev --tags qa --match every', async ({ expect }) => {
  const result = await run({ ...config, tags: ['dev', 'qa'], match: 'every' })
  expect(result.testsRegistered).toBe(1)
  expect(result.testsRun).toBe(1)
  expect(result.passed.length).toBe(0)
  expect(result.failed.length).toBe(1)
})
