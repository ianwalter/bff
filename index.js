const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { Print, chalk } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { SnapshotState } = require('jest-snapshot')
const tempy = require('tempy')
const merge = require('@ianwalter/merge')

const defaultFiles = [
  'tests.js',
  'pptr.js',
  'tests/**/*tests.js',
  'tests/**/*pptr.js'
]

/**
 * Collects test names from test files and assigns them to a worker in a
 * worker pool that runs the associated test.
 */
function run (config) {
  return new Promise(async (resolve, reject) => {
    // Create the run context using the passed configuration and defaults.
    const context = {
      ...config,
      // Initialize a count for each time a test file has been registered so
      // that the run can figure out when registration has completed and the
      // worker pool can be terminated.
      filesRegistered: 0,
      // Initialize a count for the total number of tests registered from all of
      // the test files.
      testsRegistered: 0,
      // Initialize counts for how many tests passed, failed, or were skipped.
      passed: 0,
      failed: 0,
      skipped: 0,
      // Initialize a count for the total number of tests that have been
      // run so that the run can figure out when all tests have completed and
      // the worker pool can be terminated.
      testsRun: 0
    }
    context.tests = config.tests || defaultFiles
    context.updateSnapshot = config.updateSnapshot ? 'all' : 'none'
    context.logLevel = config.logLevel || 'info'
    context.timeout = config.timeout || 60000

    // TODO:
    const webpack = { mode: 'development' }
    context.puppeteer = merge({ webpack }, config.puppeteer)

    // Create the print instance with the given log level.
    const print = new Print({ level: context.logLevel })

    // Set the worker pool options. For now, it only sets the maximum amount of
    // workers used if the concurrency setting is set.
    const poolOptions = {
      nodeWorker: 'auto',
      ...(context.concurrency ? { maxWorkers: context.concurrency } : {})
    }

    // Set the path to the file used to create a worker.
    const workerPath = path.join(__dirname, 'worker.js')

    // For registering individual tests exported from test files:
    const registrationPool = workerpool.pool(workerPath, poolOptions)

    // For actually running the tests:
    const runPool = workerpool.pool(workerPath, poolOptions)

    // Collect the in-progress test run promises in an array so that they can be
    // cancelled if need be (e.g. on failFast before pool termination).
    const inProgress = []

    // Catch an interrupt signal (SIGINT, CTRL+C) so that plugin after hooks can
    // still run before the process exits (as they may be running cleanup logic)
    // but still allow the user to force the process to exit immediately if they
    // press CTRL+C a second time.
    process.on('SIGINT', () => {
      if (context.hasFastFailure) {
        process.exit(130)
      } else {
        process.stdout.write('\n')
        print.warn(
          'Cancelling tests and running plugin after hooks', '\n',
          'Hit CTRL+C again to have the process exit immediately'
        )
        context.hasFastFailure = true
        inProgress.forEach(exec => exec.cancel())
      }
    })

    try {
      // Add the absolute paths of the test files to the run context.
      context.files = (await globby(context.tests)).map(f => path.resolve(f))

      // Call each function with the run context exported by the files
      // configured to be called before a run.
      const toHookRun = require('./lib/toHookRun')
      if (context.plugins && context.plugins.length) {
        await pSeries(context.plugins.map(toHookRun('before', context)))
      }

      // For each test file found, pass the filename to a registration pool
      // worker so that the tests within it can be collected and given to a
      // run pool worker to be run.
      context.files.forEach(async filePath => {
        // Create the file context to contain information on the test file.
        const relativePath = path.relative(process.cwd(), filePath)
        const file = { path: filePath, relativePath }

        // Construct the path to the snapshot file.
        const snapshotsDir = path.join(path.dirname(filePath), 'snapshots')
        const snapshotFilename = path.basename(filePath).replace('.js', '.snap')
        file.snapshotPath = path.join(snapshotsDir, snapshotFilename)

        if (context.puppeteer.all || file.path.match(/pptr\.js$/)) {
          // TODO:
          file.puppeteer = { path: tempy.file({ extension: 'js' }) }
        }

        // Perform registration on the test file to collect the tests that need
        // to be run.
        const tests = await registrationPool.exec('register', [file, context])

        // Increment the registration count now that registration has completed
        // for the current test file.
        context.filesRegistered++

        // Terminate the registration pool if all the test files have been
        // registered.
        if (context.filesRegistered === context.files.length) {
          registrationPool.terminate()
            .then(() => print.debug('Registration pool terminated'))
        }

        // Add the number of tests returned by test registration to the running
        // total of all tests that need to be run.
        context.testsRegistered += tests.length

        // Determine if any of the tests in the test file have the .only
        // modifier so that tests can be excluded from being run.
        const hasOnly = Object.values(tests).some(test => test.only)

        // Get the snapshot state for the current test file.
        const snapshotState = new SnapshotState(
          file.snapshotPath,
          context.updateSnapshot
        )

        // Iterate through all tests in the test file.
        const runAllTestsInFile = Promise.all(tests.map(async test => {
          // Define the test run promise outside of try-catch-finally so that it
          // can be referenced when it needs to be removed from the inProgress
          // collection.
          let testRun

          try {
            // Mark all tests as having been checked for snapshot changes so
            // that tests that have been removed can have their associated
            // snapshots removed as well when the snapshots are checked for this
            // test file.
            snapshotState.markSnapshotsAsCheckedForTest(test.name)

            if (context.hasFastFailure) {
              // Don't run the test if the failFast option is set and there has
              // been a test failure.
              print.debug('Skipping test because of failFast flag:', test.name)
            } else if (hasOnly && !test.only) {
              // Don't run the test if there is a test in the current test file
              // marked with the only modifier and it's not this test.
              print.debug('Skipping test because of only modifier:', test.name)
            } else if (test.skip) {
              // Output the test name and increment the skip count to remind
              // the user that some tests are being explicitly skipped.
              print.log('🛌', test.name)
              context.skipped++
            } else {
              // Send the test to a worker in the run pool to be run.
              testRun = runPool.exec('test', [file, test, context])

              // Push the test run promise to the inProgress collection so that,
              // if need be, it can be cancelled later (e.g. on failFast).
              inProgress.push(testRun)

              // Wait for the test run promise to complete so that the test
              // results can be handled.
              const result = await testRun

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
              // test didn't throw and error indicating a failure.
              print.success(test.name)
              context.passed++
            }
          } catch (err) {
            if (context.hasFastFailure) {
              // Ignore new thrown errors when a "fast failure" has been
              // recorded.
              return
            } else if (err.name === 'TimeoutError') {
              const relativePath = chalk.gray(file.relativePath)
              print.error(`${test.name}: timeout`, relativePath)
            } else {
              print.error(`${test.name}:`, err)
            }

            // Increment the failure count since the test threw an error
            // indicating a test failure.
            context.failed++

            // If the failFast option is set, record that there's been a "fast
            // failure" and try to cancel any in-progress test runs.
            if (context.failFast) {
              context.hasFastFailure = true
              inProgress.forEach(exec => exec.cancel())
            }
          } finally {
            // Increment the test run count now that the test has completed.
            context.testsRun++

            // Remove the current test run promise from the inProgress
            // collection.
            inProgress.splice(inProgress.indexOf(testRun), 1)
          }
        }))

        // After all the tests in the test file have been run...
        runAllTestsInFile.then(async () => {
          try {
            // The snapshot tests that weren't checked are obsolete and can be
            // removed from the snapshot file.
            if (snapshotState.getUncheckedCount()) {
              snapshotState.removeUncheckedKeys()
            }

            // Save the snapshot changes.
            snapshotState.save()

            if (
              context.hasFastFailure ||
              (context.filesRegistered === context.files.length &&
              context.testsRun === context.testsRegistered)
            ) {
              // Call each function with the run context exported by the files
              // configured to be called after a run.
              if (context.plugins && context.plugins.length) {
                await pSeries(context.plugins.map(toHookRun('after', context)))
              }

              // Terminate the run pool if all tests have been run.
              runPool.terminate(context.hasFastFailure)
                .then(() => print.debug('Run pool terminated'))

              // Resolve the run Promise with the run context which contains
              // the tests' passed/failed/skipped counts.
              resolve(context)
            }
          } catch (err) {
            reject(err)
          }
        })
      })
    } catch (err) {
      reject(err)
    }
  })
}

function handleTestArgs (name, tags, test = {}) {
  // Prevent caching of this module so module.parent is always accurate. Thanks
  // sindresorhus/meow.
  delete require.cache[__filename]

  const testFn = tags.pop()
  if (testFn && typeof testFn === 'function') {
    Object.assign(test, { testFn, tags })
    module.parent.exports[oneLine(name)] = test
    return test
  } else {
    return fn => {
      Object.assign(test, { testFn: fn, tags: testFn ? [...tags, testFn] : [] })
      module.parent.exports[oneLine(name)] = test
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

module.exports = { run, test }
