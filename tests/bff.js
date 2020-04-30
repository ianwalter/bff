const { promises: fs } = require('fs')
const path = require('path')
const execa = require('execa')
const { test, run, FailFastError } = require('..')

const config = {
  timeout: 10000,
  plugins: ['tests/helpers/plugin.js'],
  log: { stream: false, level: 'info' },
  match: 'some'
}
const toName = ({ name }) => name
const execaOpts = { reject: false }

test`bff ${async t => {
  const result = await run(config)
  t.expect(result.filesRegistered).toBe(6)
  t.expect(result.testsRegistered).toBe(28)
  t.expect(result.testsRun).toBe(28)
  t.expect(result.pass.length).toBe(14)
  t.expect(result.pass.map(toName).sort()).toMatchSnapshot()
  t.expect(result.fail.length).toBe(10)
  t.expect(result.fail.map(toName).sort()).toMatchSnapshot()
  t.expect(result.warn.length).toBe(1)
  t.expect(result.warn.map(toName).sort()).toMatchSnapshot()
  t.expect(result.skip.length).toBe(3)
  t.expect(result.skip.map(toName).sort()).toMatchSnapshot()
  t.expect(result.benchmarks.length).toBe(9)
  t.expect(result.benchmarks.map(toName).sort()).toMatchSnapshot()
}}`

test`bff --fail-fast ${async t => {
  const { stdout } = await execa('./cli.js', ['--fail-fast'], execaOpts)
  t.expect(stdout).toContain(FailFastError.message)
}}`

test`bff --tag qa ${async t => {
  const result = await run({ ...config, tag: 'qa' })
  t.expect(result.testsRegistered).toBe(2)
  t.expect(result.testsRun).toBe(2)
  t.expect(result.pass.length).toBe(1)
  t.expect(result.fail.length).toBe(1)
}}`

test`bff --tag dev --tag qa --match every ${async t => {
  const result = await run({ ...config, tag: ['dev', 'qa'], match: 'every' })
  t.expect(result.testsRegistered).toBe(1)
  t.expect(result.testsRun).toBe(1)
  t.expect(result.pass.length).toBe(0)
  t.expect(result.fail.length).toBe(1)
}}`

test`uncaught exception in test file ${async t => {
  const { stdout } = await execa('./cli.js', ['tests/uncaught.js'], execaOpts)
  t.expect(stdout).toContain("Cannot find module 'thing-that-doesnt-exist'")
}}`

test`junit ${async t => {
  await run({ ...config, junit: true })
  const junit = await fs.readFile(path.resolve('junit.xml'), 'utf8')
  // TODO: Fix toMatchSnapshotLines() to properly unescape string.
  // expect(junit).toMatchSnapshotLines()
  t.expect(junit).toBeDefined()
}}`
