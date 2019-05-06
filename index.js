const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { Print, chalk } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { toHookRun } = require('./src/lib')
const { SnapshotState } = require('jest-snapshot')

const defaultFiles = [
  'tests.js',
  'pptr.js',
  'tests/**/*tests.js',
  'tests/**/*pptr.js'
]

// TODO:
function createResultHandler (runContext, mainContext, file, snapshotState) {
  return async result => {
    if (result.hasFastFailure) {
      // Don't execute the test if the failFast option is set and
      // there has been a test failure.
      mainContext.print.debug(
        'Skipping test because of failFast flag:',
        test.name
      )
    } else if (result.excluded) {
      // Don't execute the test if there is a test in the current test file
      // marked with the only modifier and it's not this test.
      mainContext.print.debug(
        'Skipping test because of only modifier:',
        test.name
      )
    } else if (result.skipped) {
      // Output the test name and increment the skip count to remind the user
      // that some tests are being explicitly skipped.
      mainContext.print.log('🛌', test.name)
      runContext.skipped++
    } else if (result.execution) {
      // TODO: update comment
      // Wait for the execution promise to complete so that the test
      // results can be handled.
      try {
        result = await result.execution
      } catch (err) {
        result.failed = err
      }

      // Update the snapshot state with the snapshot data received
      // from the worker.
      if (result.added || result.updated) {
        snapshotState._dirty = true
        snapshotState._counters = new Map(result.counters)
        Object.assign(snapshotState._snapshotData, result.snapshots)
        snapshotState.added += result.added
        snapshotState.updated += result.updated
      }

      if (result.failed) {
        if (result.failed.name === 'TimeoutError') {
          const filePath = chalk.gray(path.relative(process.cwd(), file))
          mainContext.print.error(`${result.name}: timeout`, filePath)
        } else {
          mainContext.print.error(`${result.name}:`, result.failed)
        }

        // Increment the failure count since the test threw an error
        // indicating a test failure.
        runContext.failed++

        // If the failFast option is set, record that there's been a "fast
        // failure" and try to cancel any in-progress executions.
        if (runContext.failFast) {
          runContext.hasFastFailure = true
          mainContext.inProgress.forEach(exec => exec.cancel())
        }
      } else {
        // Output the test name and increment the pass count since the
        // test didn't throw and error indicating a failure.
        mainContext.print.success(result.name)
        runContext.passed++
      }
    }

    // Increment the execution count now that the test has completed.
    runContext.executed++

    // Remove the current execution promise from the inProgress
    // collection.
    if (result.execution) {
      const index = mainContext.inProgress.indexOf(result.execution)
      mainContext.inProgress.splice(index, 1)
    }
  }
}

/**
 * Collects tests names from tests files and assigns them to a worker in a
 * worker pool to be executed.
 */
function run (config) {
  return new Promise(async (resolve, reject) => {
    // Create the run runContext using the passed configuration and defaults.
    const runContext = {
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
    runContext.tests = config.tests || defaultFiles
    runContext.updateSnapshot = config.updateSnapshot ? 'all' : 'none'
    runContext.logLevel = config.logLevel || 'info'
    runContext.timeout = config.timeout || 60000

    const mainContext = {
      // Create the print instance with the given log level.
      print: new Print({ level: runContext.logLevel }),
      // Collect the execution promises in an array so that they can be
      // cancelled if need be (e.g. on failFast before pool termination).
      inProgress: []
    }

    // Set the worker pool options. For now, it only sets the maximum amount of
    // workers used if the concurrency setting is set.
    const poolOptions = {
      nodeWorker: 'auto',
      ...(runContext.concurrency ? { maxWorkers: runContext.concurrency } : {})
    }

    // Set the path to the file used to create a worker.
    const workerPath = path.join(__dirname, 'worker.js')

    // For registering individual tests exported from test files:
    const registrationPool = workerpool.pool(workerPath, poolOptions)

    // For actually executing the tests:
    const executionPool = workerpool.pool(workerPath, poolOptions)

    // Catch an interrupt signal (SIGINT, CTRL+C) so that plugin after hooks can
    // still run before the process exits (as they may be running cleanup logic)
    // but still allow the user to force the process to exit immediately if they
    // press CTRL+C a second time.
    process.on('SIGINT', () => {
      if (runContext.hasFastFailure) {
        process.exit(130)
      } else {
        process.stdout.write('\n')
        mainContext.print.warn(
          'Cancelling tests and running plugin after hooks', '\n',
          'Hit CTRL+C again to have the process exit immediately'
        )
        runContext.hasFastFailure = true
        mainContext.inProgress.forEach(exec => exec.cancel())
      }
    })

    try {
      // Add the absolute paths of the test files to the run runContext.
      const filePaths = await globby(runContext.tests)
      runContext.files = filePaths.map(filePath => path.resolve(filePath))

      // Execute each function with the run runContext exported by the files
      // configured to be called before a run.
      if (runContext.plugins && runContext.plugins.length) {
        await pSeries(runContext.plugins.map(toHookRun('before', runContext)))
      }

      // TODO: comment
      const usePuppeteer = runContext.puppeteer && runContext.puppeteer.all

      // For each test file found, pass the filename to a registration pool
      // worker so that the tests within it can be collected and given to a
      // execution pool worker to be run.
      runContext.files.forEach(async file => {
        // Initialize the snapshot state with a path to the snapshot file and
        // the updateSnapshot setting.
        const snapshotsDir = path.join(path.dirname(file), 'snapshots')
        const snapshotFilename = path.basename(file).replace('.js', '.snap')
        const snapshotPath = path.join(snapshotsDir, snapshotFilename)
        const snapshotOptions = { updateSnapshot: runContext.updateSnapshot }
        const snapshotState = new SnapshotState(snapshotPath, snapshotOptions)

        // TODO:
        const handlerArgs = [runContext, mainContext, file, snapshotState]
        const handleResult = createResultHandler(...handlerArgs)

        //
        const fileContext = { file, snapshotPath }

        // TODO:
        const workerArgs = [runContext, fileContext]

        let runAllTestsInFile
        if (usePuppeteer || file.match(/pptr\.js$/)) {
          // TODO:
          runContext.testsRegistered++

          // TODO:
          const results = await executionPool.exec('pptr', workerArgs)

          // TODO:
          runContext.testsRegistered += results.length - 1

          // TODO:
          runAllTestsInFile = Promise.all(results.map(handleResult))
        } else {
          // Perform registration on the test file to collect the tests that
          // need to be executed.
          const tests = await registrationPool.exec('register', workerArgs)

          // Add the number of tests returned by test registration to the
          // running total of all tests that need to be executed.
          runContext.testsRegistered += tests.length

          // Determine if any of the tests in the test file have the .only
          // modifier so that tests can be excluded from being executed.
          const hasOnly = Object.values(tests).some(test => test.only)

          // Iterate through all tests in the test file.
          runAllTestsInFile = Promise.all(tests.map(async test => {
            // Mark all tests as having been checked for snapshot changes so
            // that tests that have been removed can have their associated
            // snapshots removed as well when the snapshots are checked for
            // this test file.
            snapshotState.markSnapshotsAsCheckedForTest(test.name)

            let result = { ...test }
            if (runContext.hasFastFailure) {
              result.hasFastFailure = true
            } else if (hasOnly && !test.only) {
              result.excluded = true
            } else if (test.skip) {
              result.skipped = true
            } else {
              // Send the test to a worker in the execution pool to be
              // executed.
              const executionArgs = [runContext, fileContext, test]
              result.execution = executionPool.exec('test', executionArgs)

              // Push the execution promise to the inProgress collection so
              // that, if need be, it can be cancelled later (e.g. on
              // failFast).
              mainContext.inProgress.push(result.execution)
            }

            // TODO:
            await handleResult(result)
          }))
        }

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
              runContext.hasFastFailure ||
              (runContext.filesRegistered === runContext.files.length &&
              runContext.executed === runContext.testsRegistered)
            ) {
              // Execute each function with the run runContext exported by the
              // files configured to be called after a run.
              if (runContext.plugins && runContext.plugins.length) {
                await pSeries(
                  runContext.plugins.map(toHookRun('after', runContext))
                )
              }

              // Terminate the execution pool if all tests have been run.
              executionPool.terminate(runContext.hasFastFailure).then(
                () => mainContext.print.debug('Execution pool terminated')
              )

              // Resolve the run Promise with the run runContext which contains
              // the tests' passed/failed/skipped counts.
              resolve(runContext)
            }
          } catch (err) {
            reject(err)
          }
        })

        // Increment the registration count now that registration has completed
        // for the current test file.
        runContext.filesRegistered++

        // Terminate the registration pool if all the test files have been
        // registered.
        if (runContext.filesRegistered === runContext.files.length) {
          registrationPool.terminate().then(
            () => mainContext.print.debug('Registration pool terminated')
          )
        }
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
