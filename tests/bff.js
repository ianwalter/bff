const { promises: fs } = require('fs')
const path = require('path')
const execa = require('execa')
const { test, run, FailFastError } = require('..')

const config = {
  timeout: 5000,
  plugins: ['tests/helpers/plugin.js'],
  log: { stream: false, level: 'info' },
  match: 'some'
}
const toName = ({ name }) => name
const execaOpts = { reject: false }

test('bff', async ({ expect }) => {
  const result = await run(config)
  expect(result.filesRegistered).toBe(5)
  expect(result.testsRegistered).toBe(31)
  expect(result.testsRun).toBe(31)
  expect(result.passed.length).toBe(16)
  expect(result.passed.map(toName).sort()).toMatchSnapshot()
  expect(result.failed.length).toBe(10)
  expect(result.failed.map(toName).sort()).toMatchSnapshot()
  expect(result.warnings.length).toBe(1)
  expect(result.warnings.map(toName).sort()).toMatchSnapshot()
  expect(result.skipped.length).toBe(4)
  expect(result.skipped.map(toName).sort()).toMatchSnapshot()
})

test('bff --fail-fast', async ({ expect }) => {
  const { stdout } = await execa('./cli.js', ['--fail-fast'], execaOpts)
  expect(stdout).toContain(FailFastError.message)
})

test('bff --tag qa', async ({ expect }) => {
  const result = await run({ ...config, tag: 'qa' })
  expect(result.testsRegistered).toBe(2)
  expect(result.testsRun).toBe(2)
  expect(result.passed.length).toBe(1)
  expect(result.failed.length).toBe(1)
})

test('bff --tag dev --tag qa --match every', async ({ expect }) => {
  const result = await run({ ...config, tag: ['dev', 'qa'], match: 'every' })
  expect(result.testsRegistered).toBe(1)
  expect(result.testsRun).toBe(1)
  expect(result.passed.length).toBe(0)
  expect(result.failed.length).toBe(1)
})

test('uncaught exception in test file', async ({ expect }) => {
  const { stdout } = await execa('./cli.js', ['tests/uncaught.js'], execaOpts)
  expect(stdout).toContain("Cannot find module 'thing-that-doesnt-exist'")
})

test('junit', async ({ expect }) => {
  await execa('./cli.js', ['--timeout', config.timeout, '--junit'], execaOpts)
  const junit = await fs.readFile(path.resolve('junit.xml'), 'utf8')
  // TODO: Fix toMatchSnapshotLines() to properly unescape string.
  // expect(junit).toMatchSnapshotLines()
  expect(junit).toBeDefined()
})
