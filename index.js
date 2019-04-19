const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { Print, chalk } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { toHookExec, getSnapshotState } = require('./lib')

/**
 * Collects tests names from tests files and assigns them to a worker in a
 * worker pool to be executed.
 */
function run (config) {
  return new Promise(async resolve => {
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
      // executed so that the run can figure out when all tests have completed
      // and the worker pool can be terminated.
      executed: 0
    }
    context.tests = config.tests || ['tests.js', 'tests/**/*tests.js']
    context.updateSnapshot = config.updateSnapshot ? 'all' : 'none'
    context.logLevel = config.logLevel || 'info'
    context.timeout = config.timeout || 60000

    // Create the print instance with the given log level.
    const print = new Print({ level: context.logLevel })

    // Add the absolute paths of the test files to the run context.
    context.files = (await globby(context.tests)).map(f => path.resolve(f))

    // Execute each function with the run context exported by the files
    // configured to be called before a run.
    if (context.before && context.before.length) {
      await pSeries(context.before.map(toHookExec('before', context)))
    }

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

    // For actually executing the tests:
    const executionPool = workerpool.pool(workerPath, poolOptions)

    // For each test file found, pass the filename to a registration pool worker
    // so that the tests within it can be collected and given to a execution
    // pool worker to be run.
    context.files.forEach(async file => {
      try {
        // Perform registration on the test file to collect the tests that need
        // to be executed.
        const tests = await registrationPool.exec('register', [file, context])

        // Increment the registration count now that registration has completed
        // for the current test file.
        context.filesRegistered++

        // Add the number of tests returned by test registration to the running
        // total of all tests that need to be executed.
        context.testsRegistered += tests.length

        // Determine if any of the tests in the test file have the .only
        // modifier so that tests can be excluded from being executed.
        const hasOnly = Object.values(tests).some(test => test.only)

        // Get the snapshot state for the current test file.
        const snapshotState = getSnapshotState(file, context.updateSnapshot)

        // Iterate through all tests in the test file.
        const runAllTestsInFile = Promise.all(tests.map(async test => {
          try {
            // Mark all tests as having been checked for snapshot changes so
            // that tests that have been removed can have their associated
            // snapshots removed as well when the snapshots are checked for this
            // test file.
            snapshotState.markSnapshotsAsCheckedForTest(test.name)

            // Don't execute the test if there is a test in the test file marked
            // with the only modifier and it's not this test or if the test
            // is marked with the skip modifier.
            if (test.skip || (hasOnly && !test.only)) {
              if (test.skip) {
                // Output the test name and increment the skip count to remind
                // the user that some tests are being skipped.
                print.log('🛌', test.name)
                context.skipped++
              }
            } else {
              // Send the test to a worker in the execution pool to be executed.
              const result = await executionPool.exec(
                'test',
                [file, test, context]
              )

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
            if (err.name === 'TimeoutError') {
              print.error(
                `Timeout in test '${test.name}'`,
                chalk.gray(path.relative(process.cwd(), file))
              )
            } else {
              print.error(err)
            }
            context.failed++
          } finally {
            // Increment the execution count now that the test has completed.
            context.executed++
          }
        }))

        // After all the tests in the test file have been executed...
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
              context.filesRegistered === context.files.length &&
              context.executed === context.testsRegistered
            ) {
              // Execute each function with the run context exported by the
              // files configured to be called after a run.
              if (context.after && context.after.length) {
                await pSeries(context.after.map(toHookExec('after', context)))
              }

              // Terminate the execution pool if all tests have been run.
              executionPool.terminate()
                .then(() => print.debug('Execution pool terminated'))

              // Resolve the run Promise with the run context which contains
              // the tests' pass/fail/skip counts.
              resolve(context)
            }
          } catch (err) {
            print.error(err)
          }
        })
      } catch (err) {
        print.error(err)
      } finally {
        // Terminate the registration pool if all the test files have been
        // registered.
        if (context.filesRegistered === context.files.length) {
          registrationPool.terminate()
            .then(() => print.debug('Registration pool terminated'))
        }
      }
    })
  })
}

function test (name, testFn) {
  // Prevent caching of this module so module.parent is always accurate. Thanks
  // sindresorhus/meow.
  delete require.cache[__filename]

  if (testFn) {
    const test = typeof testFn === 'function' ? { testFn } : testFn
    module.parent.exports[oneLine(name)] = test
    return test
  } else {
    return testFn => {
      const test = typeof testFn === 'function' ? { testFn } : testFn
      module.parent.exports[oneLine(name)] = test
      return test
    }
  }
}

test.skip = function skip (name, test) {
  let val = this(name, test)
  if (test) {
    val.skip = true
    return val
  }
  return fn => {
    val = val(fn)
    val.skip = true
    return val
  }
}

test.only = function only (name, test) {
  let val = this(name, test)
  if (test) {
    val.only = true
    return val
  }
  return fn => {
    val = val(fn)
    val.only = true
    return val
  }
}

module.exports = { run, test }
