const { relative } = require('path')
const { worker } = require('workerpool')
const pSeries = require('p-series')
const pTimeout = require('p-timeout')
const { Print, chalk } = require('@ianwalter/print')
const { threadId } = require('worker_threads')

// TODO: Get log level from main process.
const print = new Print({ level: 'info' })

worker({
  async register (file, context) {
    const filePath = relative(process.cwd(), file)
    print.debug(`Registration worker ${threadId}`, chalk.gray(filePath))
    const { toHookExec } = require('./lib')

    // Create the registration context with the list of tests that are intended
    // to be executed.
    const toTest = ([name, { skip, only }]) => ({ key: name, name, skip, only })
    const tests = Object.entries(require(file)).map(toTest)
    context.registrationContext = { file, tests }

    // Execute each function with the test names exported by the files
    // configured to be called during test registration.
    if (context.registration && context.registration.length) {
      await pSeries(
        context.registration.map(toHookExec('registration', context))
      )
    }

    return context.registrationContext.tests
  },
  test (file, test, context) {
    print.debug(
      `Test worker ${threadId}`,
      chalk.cyan(test.name),
      chalk.gray(relative(process.cwd(), file))
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
      const { getSnapshotState, toHookExec } = require('./lib')

      // Extend the expect with jest-snapshot to allow snapshot testing.
      expect.extend({
        toMatchInlineSnapshot,
        toMatchSnapshot,
        toThrowErrorMatchingInlineSnapshot,
        toThrowErrorMatchingSnapshot
      })
      expect.addSnapshotSerializer = addSerializer

      // Create the context object that provides data and utilities to tests.
      let result = {}
      context.testContext = {
        file,
        ...test,
        expect,
        fail (msg) {
          throw new Error(msg || `Manual failure in test '${test.name}'`)
        },
        pass () {
          result.passed = true
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
        if (context.beforeEach && context.beforeEach.length) {
          await pSeries(
            context.beforeEach.map(toHookExec('beforeEach', context))
          )
        }

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        const promise = new Promise(async (resolve, reject) => {
          try {
            await testFn(context.testContext)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
        await pTimeout(promise, context.timeout)

        // Extract expect's state after running the test.
        const { suppressedErrors, assertionCalls } = expect.getState()

        // If there were no assertions executed, fail the test.
        if (!result.passed && assertionCalls === 0) {
          throw new Error(`No assertions in test '${test.name}'`)
        }

        // If expect has a suppressed error (e.g. a snapshot did not match)
        // then throw the error so that the test can be marked as having failed.
        if (suppressedErrors.length) {
          throw suppressedErrors[0]
        }

        const { snapshotState } = expect.getState()
        if (snapshotState.added || snapshotState.updated) {
          result = {
            counters: Array.from(snapshotState._counters),
            snapshots: {},
            added: snapshotState.added,
            updated: snapshotState.updated
          }
          for (let i = snapshotState._counters.get(test.name); i > 0; i--) {
            const key = utils.testNameToKey(test.name, i)
            result.snapshots[key] = snapshotState._snapshotData[key]
          }
        }
      } catch (err) {
        result.failed = err
      } finally {
        try {
          // Execute each function with the test context exported by the files
          // configured to be called after each test.
          if (context.afterEach && context.afterEach.length) {
            await pSeries(
              context.afterEach.map(toHookExec('afterEach', context))
            )
          }

          if (result.failed) {
            // Delete the matcher result property of the error since it can't be
            // sent over postMessage.
            delete result.failed.matcherResult

            reject(result.failed)
          } else {
            resolve(result)
          }
        } catch (err) {
          reject(err)
        }
      }
    })
  }
})
