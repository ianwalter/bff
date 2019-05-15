const path = require('path')
const { worker } = require('workerpool')
const pSeries = require('p-series')
const { Print, chalk } = require('@ianwalter/print')
const { threadId } = require('worker_threads')

worker({
  async register (file, context) {
    // Create the Print instance based on the log level set in the context
    // received from the main thread.
    const print = new Print({ level: context.logLevel })

    // Print a debug statement for this registration action with the relative
    // path of the test file that's having it's tests registered.
    const relativePath = chalk.gray(file.relativePath)
    print.debug(`Registration worker ${threadId}`, relativePath)

    if (file.puppeteer) {
      const webpack = require('webpack')
      const puppeteer = require('puppeteer')
      const merge = require('@ianwalter/merge')

      // Create a Webpack configuration specific to the test file being
      // registered.
      file.puppeteer.webpack = merge(
        {
          entry: file.path,
          output: {
            path: path.dirname(file.puppeteer.path),
            filename: path.basename(file.puppeteer.path)
          }
        },
        context.puppeteer.webpack
      )

      // Define the constant FILE_SERVER_PORT so that the fs-remote client can
      // be compiled with the correct server address.
      file.puppeteer.webpack.plugins.push(
        new webpack.DefinePlugin({ FILE_SERVER_PORT: context.fileServerPort })
      )

      // Compile the test file using Webpack.
      print.debug('Compiling Puppeteer file:', chalk.gray(file.puppeteer.path))
      const compiler = webpack(file.puppeteer.webpack)
      await new Promise((resolve, reject) => {
        compiler.run(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })

      // Launch a Puppeteer browser instance and new page.
      context.browser = await puppeteer.launch(context.puppeteer)
      context.page = await context.browser.newPage()

      // Store any error thrown in the following try catch so that the browser
      // can be closed before the error is thrown and execution of this worker
      // action terminates.
      let error
      try {
        // Add the compiled file to the page.
        await context.page.addScriptTag({ path: file.puppeteer.path })

        // Return the test map that was stored on the window context when the
        // coimpiled script was added to the page.
        context.testMap = await context.page.evaluate(() => window.testMap)
      } catch (err) {
        error = err
      }

      // Close the Puppeteer instance now that registration has completed.
      await context.browser.close()

      // If there was an error during regisration, throw it now that the browser
      // instance has been cleaned up.
      if (error) {
        throw error
      }
    } else {
      // If the test file isn't meant for the browser we can simply require it
      // to ge the map of tests.
      context.testMap = require(file.path)
    }

    // Create the registration context with the list of tests that are intended
    // to be run.
    const needsTag = context.tags && context.tags.length
    const toTests = (acc, [name, { skip, only, tags }]) => {
      const test = { key: name, name, skip, only, tags }
      if (!needsTag || (needsTag && tags.some(t => context.tags.includes(t)))) {
        acc.push(test)
      }
      return acc
    }
    file.tests = Object.entries(context.testMap).reduce(toTests, [])

    // Call each function with the test names exported by the files configured
    // to be called during test registration.
    const toHookRun = require('./lib/toHookRun')
    if (context.plugins && context.plugins.length) {
      await pSeries(
        context.plugins.map(toHookRun('registration', file, context))
      )
    }

    // Return the list of tests that need to be registered.
    return file.tests
  },
  async test (file, test, context) {
    // Create the Print instance based on the log level set in the context
    // received from the main thread.
    const print = new Print({ level: context.logLevel })

    // Print a debug statement for this test action with the test name and
    // relative path of the test file it belongs to.
    const relativePath = chalk.gray(file.relativePath)
    print.debug(`Test worker ${threadId}`, chalk.cyan(test.name), relativePath)

    if (file.puppeteer) {
      // Launch a Puppeteer browser instance and new page.
      const puppeteer = require('puppeteer')
      context.browser = await puppeteer.launch(context.puppeteer)
      context.page = await context.browser.newPage()
    }

    // Create the context that will be passed to the test function.
    const createTestContext = require('./lib/createTestContext')
    context.testContext = createTestContext(file, test, context.updateSnapshot)

    try {
      // Call each function with the test context exported by the files
      // configured to be called before each test.
      const toHookRun = require('./lib/toHookRun')
      if (context.plugins && context.plugins.length) {
        await pSeries(context.plugins.map(toHookRun('beforeEach', context)))
      }

      if (file.puppeteer) {
        // Add the compiled file to the page.
        await context.page.addScriptTag({ path: file.puppeteer.path })

        // Run the test in the browser and add the result to the local
        // testContext.
        const { browser, page, ...simpleContext } = context
        context.testContext.result = await page.evaluate(
          ({ file, test, context }) => window.runTest(file, test, context),
          { file, test, context: simpleContext }
        )

        // If the test failed, re-hydrate the JSON failure data into an Error
        // instance.
        if (context.testContext.result.failed) {
          const { message, stack } = context.testContext.result.failed
          context.testContext.result.failed = new Error(message)
          context.testContext.result.failed.stack = stack
        }
      } else {
        // Load the test file and extract the relevant test function.
        const { testFn } = require(file.path)[test.key]

        // Run the test!
        const runTest = require('./lib/runTest')
        await runTest(context.testContext, testFn, context.timeout)
      }

      // Call each function with the test context exported by the files
      // configured to be called after each test.
      if (context.plugins && context.plugins.length) {
        await pSeries(
          context.plugins.map(toHookRun('afterEach', context))
        )
      }
    } finally {
      // Close the Puppeteer instance now that the test has completed.
      if (context.browser) {
        await context.browser.close()
      }
    }

    // Return the test result to the main thread.
    if (context.testContext.result.failed) {
      throw context.testContext.result.failed
    }
    return context.testContext.result
  }
})
