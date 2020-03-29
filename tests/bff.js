const { promises: fs } = require('fs')
const path = require('path')
const execa = require('execa')
const { test, run, FailFastError } = require('..')

const config = {
  timeout: 5000,
  plugins: ['tests/helpers/plugin.js'],
  logLevel: 'info',
  match: 'some'
}
const toName = ({ name }) => name
const execaOpts = { reject: false }

test`bff ${async t => {
  const result = await run(config)
  t.expect(result.filesRegistered).toBe(5)
  t.expect(result.testsRegistered).toBe(31)
  t.expect(result.testsRun).toBe(31)
  t.expect(result.passed.length).toBe(16)
  t.expect(result.passed.map(toName).sort()).toMatchSnapshot()
  t.expect(result.failed.length).toBe(10)
  t.expect(result.failed.map(toName).sort()).toMatchSnapshot()
  t.expect(result.warnings.length).toBe(1)
  t.expect(result.warnings.map(toName).sort()).toMatchSnapshot()
  t.expect(result.skipped.length).toBe(4)
  t.expect(result.skipped.map(toName).sort()).toMatchSnapshot()
}}`

test`bff --fail-fast ${async t => {
  const { stdout } = await execa('./cli.js', ['--fail-fast'], execaOpts)
  t.expect(stdout).toContain(FailFastError.message)
}}`

test`bff --tag qa ${async t => {
  const result = await run({ ...config, tag: 'qa' })
  t.expect(result.testsRegistered).toBe(2)
  t.expect(result.testsRun).toBe(2)
  t.expect(result.passed.length).toBe(1)
  t.expect(result.failed.length).toBe(1)
}}`

test`bff --tag dev --tag qa --match every ${async t => {
  const result = await run({ ...config, tag: ['dev', 'qa'], match: 'every' })
  t.expect(result.testsRegistered).toBe(1)
  t.expect(result.testsRun).toBe(1)
  t.expect(result.passed.length).toBe(0)
  t.expect(result.failed.length).toBe(1)
}}`

test`uncaught exception in test file ${async t => {
  const { stdout } = await execa('./cli.js', ['tests/uncaught.js'], execaOpts)
  t.expect(stdout).toContain("Cannot find module 'thing-that-doesnt-exist'")
}}`

test`junit ${async t => {
  await execa('./cli.js', ['--timeout', config.timeout, '--junit'], execaOpts)
  const junit = await fs.readFile(path.resolve('junit.xml'), 'utf8')
  // TODO: Fix toMatchSnapshotLines() to properly unescape string.
  // expect(junit).toMatchSnapshotLines()
  t.expect(junit).toBeDefined()
}}`
