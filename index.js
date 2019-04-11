const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { print } = require('@ianwalter/print')
const { oneLine } = require('common-tags')
const pSeries = require('p-series')
const { toAsyncExec } = require('./utilities')

/**
 * Checks the status of the given worker pool and terminates it if there are no
 * active or pending tasks to execute and calls the given callback if defined.
 * @param {WorkerPool} pool
 * @param {Function} callback
 */
function terminatePool (pool, callback) {
  const stats = pool.stats()
  if (stats.activeTasks === 0 && stats.pendingTasks === 0) {
    pool.terminate()
    if (callback) {
      callback()
    }
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
      : config.tests || ['tests.js', 'tests/**/*tests.js']
    const { before, after, beforeEach, afterEach } = config

    // Create the run context.
    const files = (await globby(tests)).map(file => path.resolve(file))
    const context = { files, pass: 0, fail: 0, skip: 0 }

    // Execute each function with the run context exported by the files
    // configured to be called before a run.
    if (before && before.length) {
      await pSeries(before.map(toAsyncExec(context)))
    }

    // For registering individual tests exported from test files.
    const registrationPool = workerpool.pool(path.join(__dirname, 'worker.js'))

    // For actually executing the tests.
    const executionPool = workerpool.pool(path.join(__dirname, 'worker.js'))

    // For each test file found, pass the filename to a registration pool worker
    // so that the tests within it can be collected and given to a execution
    // pool worker to be run.
    context.files.forEach(async file => {
      try {
        const names = await registrationPool.exec('register', [file])

        // Send each test name and test filename to an exection pool worker so
        // that the test can be run and it's results can be reported.
        names.forEach(async name => {
          try {
            const params = [file, name, beforeEach, afterEach]
            const response = await executionPool.exec('test', params)
            if (response && response.skip) {
              context.skip++
              print.log('🛌', name)
            } else if (!response || !response.excluded) {
              context.pass++
              print.success(name)
            }
          } catch (err) {
            context.fail++
            print.error(err)
          } finally {
            // Terminate the execution pool if all tests have been run and
            // resolve the returned Promise with the tests' pass/fail counts.
            terminatePool(executionPool, async () => {
              // Execute each function with the run context exported by the
              // files configured to be called after a run.
              if (after && after.length) {
                await pSeries(after.map(toAsyncExec(context)))
              }

              // Resolve the run Promise with the run context.
              resolve(context)
            })
          }
        })
      } catch (err) {
        print.error(err)
      } finally {
        // Terminate the registration pool if all the test files have been
        // registered.
        terminatePool(registrationPool)
      }
    })
  })
}

function test (name, fn) {
  // Prevent caching of this module so module.parent is always accurate. Thanks
  // sindresorhus/meow.
  delete require.cache[__filename]

  if (fn) {
    const test = typeof fn === 'function' ? { test: fn } : fn
    module.parent.exports[oneLine(name)] = test
    return test
  } else {
    return fn => {
      const test = typeof fn === 'function' ? { test: fn } : fn
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
