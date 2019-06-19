const { worker } = require('workerpool')
const pSeries = require('p-series')
const { Print, chalk } = require('@ianwalter/print')
const { threadId } = require('worker_threads')
const merge = require('@ianwalter/merge')

worker({
  async register (file, context) {
    // Create the Print instance based on the log level set in the context
    // received from the main thread.
    const print = new Print({ level: context.logLevel })

    // Print a debug statement for this registration action with the relative
    // path of the test file that's having it's tests registered.
    const relativePath = chalk.gray(file.relativePath)
    print.debug(`Registration worker ${threadId}`, relativePath)

    // Call each function with the test names exported by the files configured
    // to be called during test registration.
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
      context.testMap = require(file.path)
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
        ? acc.concat([{ key: name, name, shouldRun: true, ...test, fn: null }])
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
    const toHookRun = require('./lib/toHookRun')

    // Create the Print instance based on the log level set in the context
    // received from the main thread.
    const print = new Print({ level: context.logLevel })

    // Print a debug statement for this test action with the test name and
    // relative path of the test file it belongs to.
    const relativePath = chalk.gray(file.relativePath)
    print.debug(`Test worker ${threadId}`, chalk.cyan(test.name), relativePath)

    // Add the file and test data to the testContext.
    merge(context.testContext, file, test)

    try {
      // Call each function with the test context exported by the files
      // configured to be called before each test.
      if (context.plugins && context.plugins.length) {
        await pSeries(
          context.plugins.map(toHookRun('beforeEach', file, context))
        )
      }

      if (test.shouldRun) {
        // Enhance the context passed to the test function with testing
        // utilities.
        const enhanceTestContext = require('./lib/enhanceTestContext')
        enhanceTestContext(context.testContext)

        // Load the test file and extract the relevant test function.
        const { fn } = require(file.path)[test.key]

        // Run the test!
        const runTest = require('./lib/runTest')
        await runTest(context.testContext, fn)
      }
    } finally {
      // Call each function with the test context exported by the files
      // configured to be called after each test.
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
