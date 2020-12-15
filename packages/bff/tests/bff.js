import { promises as fs } from 'fs'
import path from 'path'
import execa from 'execa'
import { test, run, FailFastError } from '../index.js'

const config = {
  timeout: 5000,
  plugins: ['tests/helpers/plugin.js'],
  log: { stream: false, level: 'debug' },
  match: 'some'
}
const toName = ({ name }) => name
const execaOpts = { reject: false }

// This covers running all of the tests via the run function and verifying that
// the results match their snapshots and the status counts are correct.
test('bff', async t => {
  const result = await run(config)
  t.expect(result.filesRegistered).toBe(5)
  t.expect(result.testsRegistered).toBe(32)
  t.expect(result.testsRun).toBe(32)
  t.expect(result.passed.length).toBe(17)
  t.expect(result.passed.map(toName).sort()).toMatchSnapshot()
  t.expect(result.failed.length).toBe(10)
  t.expect(result.failed.map(toName).sort()).toMatchSnapshot()
  t.expect(result.warnings.length).toBe(1)
  t.expect(result.warnings.map(toName).sort()).toMatchSnapshot()
  t.expect(result.skipped.length).toBe(4)
  t.expect(result.skipped.map(toName).sort()).toMatchSnapshot()
})

// This tests the fail-fast option via CLI.
test('bff --fail-fast', async t => {
  const { stdout } = await execa('./cli.js', ['--fail-fast'], execaOpts)
  t.expect(stdout).toContain(FailFastError.message)
})

// This tests the tag option via the run function.
test('bff --tag qa', async t => {
  const result = await run({ ...config, tag: 'qa' })
  t.expect(result.testsRegistered).toBe(2)
  t.expect(result.testsRun).toBe(2)
  t.expect(result.passed.length).toBe(1)
  t.expect(result.failed.length).toBe(1)
})

// This tests the --every tag option via the run function.
test('bff --tag dev --tag qa --match every', async t => {
  const result = await run({ ...config, tag: ['dev', 'qa'], match: 'every' })
  t.expect(result.testsRegistered).toBe(1)
  t.expect(result.testsRun).toBe(1)
  t.expect(result.passed.length).toBe(0)
  t.expect(result.failed.length).toBe(1)
})

// This tests that uncaught exceptions in test files outside of tests functions
// are caught and fail the test suite via the CLI.
test('uncaught exception in test file', async t => {
  const { stdout } = await execa('./cli.js', ['tests/uncaught.js'], execaOpts)
  t.expect(stdout).toContain("Cannot find package 'thing-that-doesnt-exist'")
})

// This tests that the test results are outputted to a JUnit file properly via
// the CLI.
test('bff --junit', async t => {
  await execa('./cli.js', ['--timeout', config.timeout, '--junit'], execaOpts)
  const junit = await fs.readFile(path.resolve('junit.xml'), 'utf8')
  // TODO: Fix toMatchSnapshotLines() to properly unescape string.
  // expect(junit).toMatchSnapshotLines()
  t.expect(junit).toBeDefined()
})

// This tests that the --runs option runs the test suite the specified amount of
// times via the CLI.
test('bff --runs 2', async t => {
  const args = ['--timeout', config.timeout, '--runs', '2']
  const { stdout } = await execa('./cli.js', args, execaOpts)
  t.expect(stdout.split('10 failed').length).toBe(3)
})

test('bff --failed', async t => {
  let response1, response2
  try {
    let args = ['-fjT', config.timeout, 'tests/fail.tests.js']
    response1 = await execa('./cli.js', args, execaOpts)
    t.expect(response1.failed).toBe(true)

    args = ['--failed', '-T', config.timeout]
    response2 = await execa('./cli.js', args, execaOpts)
    t.expect(response2.failed).toBe(true)
    t.expect(response2.stdout).toContain('Running failed tests in junit.xml')
    t.expect(response2.stdout).toContain('1 failed')
  } catch (err) {
    t.logger.error(err, response1, response2)
    throw err
  }
})
