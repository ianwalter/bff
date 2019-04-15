const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { print } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { toAsyncExec, getSnapshotState } = require('./lib')

/**
 * Checks the status of the given worker pool and terminates it if there are no
 * active or pending tasks to execute.
 * @param {WorkerPool} pool
 */
function terminatePool (pool) {
  const stats = pool.stats()
  if (stats.activeTasks === 0 && stats.pendingTasks === 0) {
    pool.terminate()
  }
}

/**
 * Collects tests names from tests files and assigns them to a worker in a
 * worker pool to be executed.
 */
function run (config) {
  return new Promise(async resolve => {
    const tests = config._.length
      ? config._
      : (config.tests || ['tests.js', 'tests/**/*tests.js'])
    const updateSnapshot = config.updateSnapshot ? 'all' : 'none'
    const { before, after, beforeEach, afterEach, registration } = config

    // Create the run context.
    const files = (await globby(tests)).map(file => path.resolve(file))
    const context = { files, pass: 0, fail: 0, skip: 0 }

    // Execute each function with the run context exported by the files
    // configured to be called before a run.
    if (before && before.length) {
      await pSeries(before.map(toAsyncExec(context)))
    }

    // Set the worker pool options. For now, it only sets the maximum amount of
    // workers used if the concurrency setting is set.
    const poolOptions = {
      ...(config.concurrency ? { maxWorkers: config.concurrency } : {})
    }

    // Set the path to the file used to create a worker.
    const workerPath = path.join(__dirname, 'worker.js')

    // For registering individual tests exported from test files.
    const registrationPool = workerpool.pool(workerPath, poolOptions)

    // Initialize a count for each time a test file has been registered so that
    // the run can figure out when registration has completed and the worker
    // pool can be terminated.
    let registrationCount = 0

    // For actually executing the tests.
    const executionPool = workerpool.pool(workerPath, poolOptions)

    // Initialize counts for the number of total tests and the numbers of tests
    // that have been executed so that the run can figure out when all tests
    // have completed and the worker pool can be terminated.
    let testCount = 0
    let executionCount = 0

    // For each test file found, pass the filename to a registration pool worker
    // so that the tests within it can be collected and given to a execution
    // pool worker to be run.
    context.files.forEach(async file => {
      try {
        // Perform registration on the test file to collect the tests that need
        // to be executed.
        const params = [file, registration]
        const tests = await registrationPool.exec('register', params)

        // Increment the registration count now that registration has completed
        // for the current test file.
        registrationCount++

        // Add the number of tests returned by test registration to the running
        // total of all tests that need to be executed.
        testCount += tests.length

        // Determine if any of the tests in the test file have the .only
        // modifier so that tests can be excluded from being executed.
        const hasOnly = Object.values(tests).some(test => test.only)

        // Get the snapshot state for the current test file.
        const snapshotState = getSnapshotState(file, updateSnapshot)

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
                context.skip++
              }
            } else {
              // Send the test to a worker in the execution pool to be executed.
              const params = [file, test, beforeEach, afterEach, updateSnapshot]
              const response = await executionPool.exec('test', params)

              // Update the snapshot state with the snapshot data received from
              // the worker.
              if (response && (response.added || response.updated)) {
                snapshotState._dirty = true
                snapshotState._counters = new Map(response.counters)
                Object.assign(snapshotState._snapshotData, response.snapshots)
                snapshotState.added += response.added
                snapshotState.updated += response.updated
              }

              // Output the test name and increment the pass count since the
              // test didn't throw and error indicating a failure.
              print.success(test.name)
              context.pass++
            }
          } catch (err) {
            print.error(err)
            context.fail++
          } finally {
            // Increment the execution count now that the test has completed.
            executionCount++

            const registrationDone = registrationCount === context.files.length
            if (registrationDone && executionCount === testCount) {
              // Execute each function with the run context exported by the
              // files configured to be called after a run.
              if (after && after.length) {
                await pSeries(after.map(toAsyncExec(context)))
              }

              // Terminate the execution pool if all tests have been run.
              terminatePool(executionPool)

              // Resolve the run Promise with the run context which contains the
              // tests' pass/fail/skip counts.
              resolve(context)
            }
          }
        }))

        // Update the snapshots only after all tests in the associated file have
        // completed.
        runAllTestsInFile.then(() => {
          // The snapshot tests that weren't checked are obsolete and can be
          // removed from the snapshot file.
          if (snapshotState.getUncheckedCount()) {
            snapshotState.removeUncheckedKeys()
          }

          // Save the snapshot changes.
          snapshotState.save()
        })
      } catch (err) {
        print.error(err)
      } finally {
        // Terminate the registration pool if all the test files have been
        // registered.
        if (registrationCount === context.files.length) {
          terminatePool(registrationPool)
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
