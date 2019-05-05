const path = require('path')
const { worker } = require('workerpool')
const pSeries = require('p-series')
const { Print, chalk } = require('@ianwalter/print')
const { threadId } = require('worker_threads')

worker({
  async register (file, context) {
    const print = new Print({ level: context.logLevel })
    const filePath = path.relative(process.cwd(), file)
    print.debug(`Registration worker ${threadId}`, chalk.gray(filePath))
    const { toHookExec } = require('./src/lib')

    // Create the registration context with the list of tests that are intended
    // to be executed.
    const needsTag = context.tags && context.tags.length
    const toTests = (acc, [name, { skip, only, tags }]) => {
      const test = { key: name, name, skip, only, tags }
      if (!needsTag || (needsTag && tags.some(t => context.tags.includes(t)))) {
        acc.push(test)
      }
      return acc
    }
    const tests = Object.entries(require(file)).reduce(toTests, [])
    context.registrationContext = { file, tests }

    // Execute each function with the test names exported by the files
    // configured to be called during test registration.
    if (context.plugins && context.plugins.length) {
      await pSeries(
        context.plugins.map(toHookExec('registration', context))
      )
    }

    return context.registrationContext.tests
  },
  test (file, test, context) {
    const pTimeout = require('p-timeout')

    const print = new Print({ level: context.logLevel })
    print.debug(
      `Test worker ${threadId}`,
      chalk.cyan(test.name),
      chalk.gray(path.relative(process.cwd(), file))
    )

    return new Promise(async (resolve, reject) => {
      const expect = require('expect')
      const {
        addSerializer,
        toMatchSnapshot,
        toMatchInlineSnapshot,
        toThrowErrorMatchingSnapshot,
        toThrowErrorMatchingInlineSnapshot,
        utils
      } = require('jest-snapshot')
      const { getSnapshotState, toHookExec } = require('./src/lib')

      // Extend the expect with jest-snapshot to allow snapshot testing.
      expect.extend({
        toMatchInlineSnapshot,
        toMatchSnapshot,
        toThrowErrorMatchingInlineSnapshot,
        toThrowErrorMatchingSnapshot
      })
      expect.addSnapshotSerializer = addSerializer

      // Create the context object that provides data and utilities to tests.
      context.testContext = {
        ...test,
        file,
        result: {},
        expect,
        fail (reason = 'manual failure') {
          throw new Error(reason)
        },
        pass (reason = 'manual pass') {
          context.testContext.result.passed = reason
        }
      }

      try {
        // Load the test file and extract the test object.
        const { testFn } = require(file)[test.key]

        // Update expect's state with the snapshot state and the test name.
        expect.setState({
          assertionCalls: 0,
          suppressedErrors: [],
          snapshotState: getSnapshotState(file, context.updateSnapshot),
          currentTestName: test.name
        })

        // Execute each function with the test context exported by the files
        // configured to be called before each test.
        if (context.plugins && context.plugins.length) {
          await pSeries(
            context.plugins.map(toHookExec('beforeEach', context))
          )
        }

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        const promise = new Promise(async (resolve, reject) => {
          try {
            await testFn(testContext)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
        await pTimeout(promise, context.timeout)

        // Extract expect's state after running the test.
        const { suppressedErrors, assertionCalls } = expect.getState()

        // If there were no assertions executed, fail the test.
        if (!testContext.result.passed && assertionCalls === 0) {
          throw new Error('no assertions made')
        }

        // If expect has a suppressed error (e.g. a snapshot did not match)
        // then throw the error so that the test can be marked as having failed.
        if (suppressedErrors.length) {
          throw suppressedErrors[0]
        }

        const { snapshotState } = expect.getState()
        if (snapshotState.added || snapshotState.updated) {
          testContext.result = {
            counters: Array.from(snapshotState._counters),
            snapshots: {},
            added: snapshotState.added,
            updated: snapshotState.updated
          }
          for (let i = snapshotState._counters.get(test.name); i > 0; i--) {
            const key = utils.testNameToKey(test.name, i)
            testContext.result.snapshots[key] = snapshotState._snapshotData[key]
          }
        }
      } catch (err) {
        testContext.result.failed = err
      } finally {
        try {
          // Execute each function with the test context exported by the files
          // configured to be called after each test.
          if (context.plugins && context.plugins.length) {
            await pSeries(
              context.plugins.map(toHookExec('afterEach', context))
            )
          }

          if (testContext.result.failed) {
            // Delete the matcher result property of the error since it can't be
            // sent over postMessage.
            delete testContext.result.failed.matcherResult

            reject(testContext.result.failed)
          } else {
            resolve(testContext.result)
          }
        } catch (err) {
          reject(err)
        }
      }
    })
  },
  async pptr (file, context) {
    const puppeteer = require('puppeteer')
    const webpack = require('webpack')
    const merge = require('@ianwalter/merge')
    const MemoryFileSystem = require('memory-fs')

    const print = new Print({ level: context.logLevel })
    print.debug(
      `Test worker ${threadId}`,
      '(Puppeteer)',
      chalk.gray(path.relative(process.cwd(), file))
    )

    // Launch the Puppeteer browser and create the page instance.
    const browser = await puppeteer.launch(context.puppeteer)
    const page = await browser.newPage()

    // Create an in-memory filesystem to use with Webpack.
    const mfs = new MemoryFileSystem()

    // Create the Webpack compiler.
    const options = {
      mode: 'development',
      target: 'web',
      entry: 'main.js',
      outputFileSystem: mfs
    }
    const compiler = webpack(merge(options, context.puppeteer.webpack))

    return new Promise((resolve, reject) => {
      // Create the bundle by running the Webpack compiler.
      compiler.run(async err => {
        if (err) {
          reject(err)
        }

        try {
          // Read the code generated by the Webpack compiler from the memory
          // filesystem.
          const bundle = mfs.readFileSync(file, 'utf8')

          // TODO:
          page.addScriptTag({ mode: true, source: bundle })

          // TODO:
          const browserPath = path.join(__dirname, 'dist', 'browserMain.js')
          page.addScriptTag({ module: true, path: browserPath })

          // TODO:
          context.workerPath = path.join(__dirname, 'dist', 'browserWorker.js')
          page.addScriptTag({ module: true, path: context.workerPath })

          // TODO:
          resolve(await page.evaluate(
            ({ file, context }) => window.run(file, context),
            { file, context }
          ))
        } catch (err) {
          reject(err)
        }
      })
    })
  }
})
