import { worker } from 'workerpool'
import plug from '@generates/plug'
import generatesLogger from '@generates/logger'
import { merge } from '@generates/merger'
import workerThreads from 'worker_threads'
import createTimer from '@ianwalter/timer'
import runTest from './lib/runTest.js'
import enhanceTestContext from './lib/enhanceNodeTestContext.js'
import cloneable from '@ianwalter/cloneable'

const { createLogger, chalk } = generatesLogger
const threadId = workerThreads.threadId

async function importTests (file, testKey = null) {
  // Return a single test if it's been requested and already imported.
  const tests = testKey && global.bff?.tests
  let test = tests && tests[file.path] && tests[file.path][testKey]
  if (test) return test

  // Add the file to global so that the tests get namespaced with the filename
  // when the test file is imported/executed and added to global.
  const data = { file: file.path, tests: {} }
  global.bff = global.bff ? merge(global.bff, data) : data

  // Import the tests from the test file.
  try {
    await import(file.path)
  } catch (err) {
    // Wrap errorr in cloneable so that it can be sent back to the main thread
    // properly.
    throw cloneable(err)
  }

  // Return a single test if only one is requested.
  test = testKey && global.bff.tests[file.path][testKey]
  if (test) return test

  // Otherwise, return a map of all tests in the test file.
  return global.bff.tests[file.path]
}

worker({
  seppuku () {
    const namespace = `bff.worker.${threadId}.seppuku`
    const logger = createLogger({ level: 'info', namespace })
    logger.debug('Seppuku')

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

    // Register configured plugins.
    const executePluginPhase = await plug({
      phases: ['registration'],
      files: context.plugins
    })

    // Execute the registration phase for conigured plugins.
    await executePluginPhase('registration', { ...context, file })

    // If the map of tests in the current test file hasn't been added to the
    // context, import the tests from the test file.
    if (!context.testMap) context.testMap = await importTests(file)

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
    if (context.augmentTests) file.tests = context.augmentTests(file.tests)

    // Return the file context with the the list of registered tests.
    return file
  },
  async test (file, test, context) {
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

    // Enhance the context passed to the test function with testing utilities.
    if (context.enhanceTestContext) enhanceTestContext(context.testContext)

    // Register configured plugins.
    const executePluginPhase = await plug({
      phases: ['beforeTest', 'test', 'afterTest'],
      files: context.plugins
    })

    try {
      // Execute the beforeTest phase for conigured plugins.
      await executePluginPhase('beforeTest', { ...context, file })

      // If the verbose option is set, start a timer for the test.
      if (context.verbose) context.timer = createTimer()

      // Execute the test phase for conigured plugins.
      await executePluginPhase('test', { ...context, file })

      if (!context.testContext.hasRun) {
        // If the verbose option is set, start a timer for the test.
        if (context.verbose) context.timer = createTimer()

        // Import the tests from the test file.
        const { fn } = await importTests(file, test.key)

        // Run the test!
        await runTest(context.testContext, fn)
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
      // Execute the afterTest phase for conigured plugins.
      await executePluginPhase('afterTest', { ...context, file })
    }

    // Return the test result to the main thread.
    if (context.testContext.result.failed) {
      throw context.testContext.result.failed
    }
    return context.testContext.result
  }
})
