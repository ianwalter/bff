const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { createPrint, chalk } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { SnapshotState } = require('jest-snapshot')
const merge = require('@ianwalter/merge')
const callsites = require('callsites')
const shuffle = require('array-shuffle')

const defaultFiles = [
  '*tests.js',
  '*pptr.js',
  'tests/**/*tests.js',
  'tests/**/*pptr.js'
]

class FailFastError extends Error {
  constructor () {
    super(FailFastError.message)
  }
}
FailFastError.message = 'Run failed immediately since failFast option is set'

/**
 * Collects test names from test files and assigns them to a worker in a
 * worker pool that runs the associated test.
 */
async function run (config) {
  // Create the run context using the passed configuration and defaults.
  const context = {
    tests: defaultFiles,
    testContext: { hasRun: false, result: {}, timeout: config.timeout },
    // Initialize a count for each time a test file has been registered so that
    // the main thread can figure out when registration has completed and the
    // worker pool can be terminated.
    filesRegistered: 0,
    // Initialize a count for the total number of tests registered from all of
    // the test files.
    testsRegistered: 0,
    // Initialize collections for tests that passed, failed, or were skipped.
    passed: [],
    failed: [],
    warnings: [],
    skipped: [],
    // Initialize a count for the total number of tests that have been run so
    // that the run can figure out when all tests have completed and the worker
    // pool can be terminated.
    testsRun: 0
  }

  // Destructure passed configuration and add it to testContext and context.
  const { updateSnapshot, tag = [], failed, ...restOfConfig } = config
  context.testContext.updateSnapshot = updateSnapshot ? 'all' : 'none'
  context.tags = Array.isArray(tag) ? tag : [tag]
  merge(context, restOfConfig)

  // Create the print instance with the given log level.
  const print = createPrint(context.log)

  // Add the absolute paths of the test files to the run context.
  context.files = shuffle(await globby(context.tests, { absolute: true }))
  print.debug('Run context', context)

  // Throw an error if there are no tests files found.
  if (context.files.length === 0) {
    throw new Error('No test files found.')
  }

  // Set the worker pool options. For now, it only sets the maximum amount of
  // workers used if the concurrency setting is set.
  const poolOptions = {
    ...(context.concurrency ? { maxWorkers: context.concurrency } : {})
  }

  // Set the path to the file used to create a worker.
  const workerPath = path.join(__dirname, 'worker.js')

  // For registering individual tests exported from test files:
  const registrationPool = workerpool.pool(workerPath, poolOptions)

  // For actually running the tests:
  const runPool = workerpool.pool(workerPath, poolOptions)

  // Terminate the worker pools when a user presses CTRL+C.
  process.on('SIGINT', async () => {
    context.err = new Error('RUN CANCELLED!')
    registrationPool.terminate(true)
    runPool.terminate(true)
  })

  // Sequentially run any before hooks specified by plugins.
  const toHookRun = require('./lib/toHookRun')
  if (context.plugins && context.plugins.length) {
    await pSeries(context.plugins.map(toHookRun('before', context)))
  }

  try {
    // For each test file found, pass the filename to a registration pool
    // worker so that the tests within it can be collected and given to a
    // run pool worker to be run.
    await Promise.all(context.files.map(async filePath => {
      // Create the file context to contain information on the test file.
      const relativePath = path.relative(process.cwd(), filePath)
      const file = { path: filePath, relativePath }

      // Construct the path to the snapshot file.
      const snapshotsDir = path.join(path.dirname(filePath), 'snapshots')
      const snapshotFilename = `${path.basename(filePath)}.snap`
      file.snapshotPath = path.join(snapshotsDir, snapshotFilename)

      // Perform registration on the test file to collect the tests that need
      // to be run.
      merge(file, await registrationPool.exec('register', [file, context]))

      // Increment the registration count now that registration has completed
      // for the current test file.
      context.filesRegistered++

      // Terminate the registration pool if all the test files have been
      // registered.
      if (context.filesRegistered === context.files.length) {
        const numberOfTests = context.testsRegistered + file.tests.length
        print.debug('Number of tests:', numberOfTests)
        registrationPool.terminate()
          .then(() => print.debug('Registration pool terminated'))
      }

      // Add the number of tests returned by test registration to the running
      // total of all tests that need to be run.
      context.testsRegistered += file.tests.length

      // Determine if any of the tests in the test file have the .only
      // modifier so that tests can be excluded from being run.
      const hasOnly = Object.values(file.tests).some(test => test.only)

      // Get the snapshot state for the current test file.
      const snapshotState = new SnapshotState(
        file.snapshotPath,
        { updateSnapshot: context.testContext.updateSnapshot }
      )

      // Iterate through all tests in the test file.
      await Promise.all(shuffle(file.tests).map(async test => {
        if (context.hasSignalInterruption) {
          throw new Error('Stopping test run due to signal interruption')
        }

        let result
        try {
          // Mark all tests as having been checked for snapshot changes so
          // that tests that have been removed can have their associated
          // snapshots removed as well when the snapshots are checked for this
          // test file.
          snapshotState.markSnapshotsAsCheckedForTest(test.name)

          const skipViaOnly = hasOnly && !test.only
          if (skipViaOnly || test.skip) {
            // Output the test name and increment the skip count to remind
            // the user that some tests are being explicitly skipped.
            const msg = `${context.testsRun + 1}. ${test.name}`
            print.log('🛌', msg, skipViaOnly ? chalk.dim('(via only)') : '')
            context.skipped.push({ ...test, file: relativePath })
          } else if (!failed || failed.includes(test.name)) {
            // Send the test to a worker in the run pool to be run.
            result = await runPool.exec('test', [file, test, context])

            // Update the snapshot state with the snapshot data received from
            // the worker.
            if (result && (result.added || result.updated)) {
              snapshotState._dirty = true
              snapshotState._counters = new Map(result.counters)
              Object.assign(snapshotState._snapshotData, result.snapshots)
              snapshotState.added += result.added
              snapshotState.updated += result.updated
            }

            // Output the test name and increment the pass count since the
            // test didn't throw an error indicating a failure.
            print.success(`${context.testsRun + 1}. ${test.name}`)
            context.passed.push({ ...test, file: relativePath })
          }
        } catch (err) {
          const file = relativePath
          const workerpoolErrors = ['Worker terminated', 'Pool terminated']
          if (workerpoolErrors.includes(err.message)) {
            // Ignore 'Worker terminated' errors since there is already output
            // when a run is cancelled.
            return
          } if (test.warn) {
            print.warn(`${context.testsRun + 1}. ${test.name}:`, err)
            return context.warnings.push({ ...test, err: err.message, file })
          } else if (err.name === 'TimeoutError') {
            const msg = `${context.testsRun + 1}. ${test.name}: timeout`
            print.error(msg, chalk.dim(file))
          } else {
            print.error(`${context.testsRun + 1}. ${test.name}:`, err)
          }

          // Increment the failure count since the test threw an error
          // indicating a test failure.
          context.failed.push({ ...test, err: err.message, file })
        } finally {
          // Increment the test run count now that the test has completed.
          context.testsRun++

          // Log the relative file path and test duration if in verbose mode.
          if (context.verbose) {
            const pad = ''.padEnd((context.testsRun * 100).toString().length)
            print.log(`${pad}${file.relativePath}:${test.lineNumber}`)
            if (result && result.duration) {
              print.log(chalk.dim(`${pad}in`, result.duration))
            }
          }
        }

        // If the failFast option is set, throw an error so that the test run is
        // immediately failed.
        const [err] = context.failed
        if (err && context.failFast) {
          throw new FailFastError()
        }
      }))

      // The snapshot tests that weren't checked are obsolete and can be
      // removed from the snapshot file.
      if (snapshotState.getUncheckedCount()) {
        snapshotState.removeUncheckedKeys()
      }

      // Save the snapshot changes.
      snapshotState.save()
    }))
  } catch (err) {
    // Add the fatal error to the context so the CLI can fail the run.
    context.err = err
  }

  // Sequentially run any after hooks specified by plugins.
  if (context.plugins && context.plugins.length) {
    await pSeries(context.plugins.map(toHookRun('after', context)))
  }

  // Terminate the run pool now that all tests have been run.
  runPool.terminate().then(() => print.debug('Run pool terminated'))

  return context
}

function handleTestArgs (name, tags, test = {}) {
  // Prevent caching of this module so module.parent is always accurate. Thanks
  // sindresorhus/meow.
  delete require.cache[__filename]

  // Add the test line number to the object so it can be shown in verbose mode.
  test.lineNumber = callsites()[2].getLineNumber()

  const testFn = tags.pop()
  Object.assign(test, { fn: testFn, tags })
  module.parent.exports[oneLine(name)] = test
  if (testFn && typeof testFn === 'function') {
    return test
  } else {
    return fn => {
      Object.assign(test, { fn, tags: testFn ? [...tags, testFn] : [] })
      return test
    }
  }
}

function test (name, ...tags) {
  return handleTestArgs(name, tags)
}

test.skip = function skip (name, ...tags) {
  return handleTestArgs(name, tags, { skip: true })
}

test.only = function only (name, ...tags) {
  return handleTestArgs(name, tags, { only: true })
}

test.warn = function warn (name, ...tags) {
  return handleTestArgs(name, tags, { warn: true })
}

module.exports = { run, test, FailFastError }
