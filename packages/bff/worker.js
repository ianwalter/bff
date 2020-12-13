const path = require('path')
const { worker } = require('workerpool')
const pSeries = require('p-series')
const { createLogger, chalk } = require('@generates/logger')

let threadId = process.pid
try {
  const workerThreads = require('worker_threads')
  threadId = workerThreads.threadId
} catch (err) {
  // Ignore error.
}

worker({
  seppuku () {
    // Emit a SIGINT to itself so that processes terminate gracefully.
    process.kill(process.pid, 'SIGINT')
  },
  async register (file, context) {
    // Create the logger instance based on the log level set in the context
    // received from the main thread.
    const namespace = `bff.worker.${threadId}.register`
    const logger = createLogger({ ...context.log, namespace })

    // Log a debug statement for this registration action with the relative
    // path of the test file that's having it's tests registered.
    const relativePath = chalk.dim(file.relativePath)
    logger.debug(`Registration worker ${threadId}`, relativePath)

    // Sequentially run any registration hooks specified by plugins.
    const toHookRun = require('./lib/toHookRun')
    if (context.plugins && context.plugins.length) {
      await pSeries(
        context.plugins.map(toHookRun('registration', file, context))
      )
    }

    // If the map of tests in the current test file hasn't been added to the
    // context, require the test file and use it's exports object as the test
    // map.
    if (!context.testMap) {
      try {
        context.testMap = require(file.path)
      } catch (err) {
        if (err.code === 'ERR_REQUIRE_ESM') {
          const dist = require('@ianwalter/dist')
          const requireFromString = require('require-from-string')
          const { cjs } = await dist({ input: file.path, cjs: true })
          requireFromString(cjs[1], file.name)
          context.testMap = global.tests
        } else {
          throw err
        }
      }
    }

    // Add a list of tests from the test file that are intended to be run to
    // the file context.
    const { tags, match } = context
    const tagsMatch = test => {
      if (['some', 'every'].includes(match)) {
        return tags[match](tag => test.tags.includes(tag))
      }
      throw new Error(`match value must be 'some' or 'every', not '${match}'`)
    }
    file.tests = Object.entries(context.testMap).reduce(
      (acc, [name, test]) => !tags.length || (tags.length && tagsMatch(test))
        ? acc.concat([{ key: name, name, ...test, fn: null }])
        : acc,
      []
    )

    // If an augmentTests method has been added to the context by a plugin, call
    // it with the list of tests so that the plugin can alter them if necessary.
    if (context.augmentTests) {
      file.tests = context.augmentTests(file.tests)
    }

    // Return the file context with the the list of registered tests.
    return file
  },
  async test (file, test, context) {
    const merge = require('@ianwalter/merge')
    const createTimer = require('@ianwalter/timer')
    const toHookRun = require('./lib/toHookRun')

    // Create the logger instance based on the log level set in the context
    // received from the main thread.
    const namespace = `bff.worker.${threadId}.test`
    const logger = createLogger({ ...context.log, namespace })

    // Log a debug statement for this test action with the test name and
    // relative path of the test file it belongs to.
    const relativePath = chalk.dim(file.relativePath)
    logger.debug(`Test worker ${threadId}`, chalk.cyan(test.name), relativePath)

    // Add the file and test data to the testContext.
    merge(context.testContext, file, test)

    try {
      if (context.plugins && context.plugins.length) {
        // Sequentially run any beforeEach hooks specified by plugins.
        await pSeries(
          context.plugins.map(toHookRun('beforeEach', file, context))
        )

        // If the verbose option is set, start a timer for the test.
        if (context.verbose) {
          context.timer = createTimer()
        }

        // Sequentially run any runTest hooks specified by plugins.
        await pSeries(context.plugins.map(toHookRun('runTest', file, context)))
      }

      if (!context.testContext.hasRun) {
        // If the verbose option is set, start a timer for the test.
        if (context.verbose) {
          context.timer = createTimer()
        }

        // Enhance the context passed to the test function with testing
        // utilities.
        const enhanceTestContext = require('./lib/enhanceTestContext')
        enhanceTestContext(context.testContext)
        context.testContext.logger = logger

        try {
          // TODO: Load the test file and
          require(file.path)
        } catch (err) {
          if (err.code === 'ERR_REQUIRE_ESM') {
            const dist = require('@ianwalter/dist')
            const requireFromString = require('require-from-string')
            const { cjs } = await dist({ input: file.path, cjs: true })
            requireFromString(cjs[1], file.name)
          } else {
            throw err
          }
        }

        // Run the test!
        const runTest = require('./lib/runTest')
        await runTest(context.testContext, global.tests[test.key].fn)
        context.testContext.hasRun = true
      }

      // If there was a timer started for the test, stop the timer, get the
      // timer's duration, and add it to the test result.
      if (context.timer) {
        const duration = context.timer.duration()
        logger.debug('Test duration', duration)
        context.testContext.result.duration = duration
      }
    } finally {
      // Sequentially run any afterEach hooks specified by plugins.
      if (context.plugins && context.plugins.length) {
        await pSeries(
          context.plugins.map(toHookRun('afterEach', file, context))
        )
      }
    }

    // Return the test result to the main thread.
    if (context.testContext.result.failed) {
      throw context.testContext.result.failed
    }
    return context.testContext.result
  }
})
