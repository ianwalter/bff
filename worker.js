const { relative } = require('path')
const { worker } = require('workerpool')
const pSeries = require('p-series')
const { Print, chalk } = require('@ianwalter/print')
const { threadId } = require('worker_threads')

// TODO: Get log level from main process.
chalk.enabled = true
chalk.level = 1
const print = new Print({ level: 'debug' })

worker({
  async register (file, registration) {
    const filePath = relative(process.cwd(), file)
    print.debug(`Registration worker ${threadId}`, chalk.gray(filePath))
    const { toAsyncExec } = require('./lib')

    // Create the registration context with the list of tests that are intended
    // to be executed.
    const toTest = ([name, { skip, only }]) => ({ key: name, name, skip, only })
    const context = { tests: Object.entries(require(file)).map(toTest) }

    // Execute each function with the test names exported by the files
    // configured to be called during test registration.
    if (registration && registration.length) {
      await pSeries(registration.map(toAsyncExec(context)))
    }

    return context.tests
  },
  test (file, test, beforeEachFiles, afterEachFiles, updateSnapshot) {
    const filePath = relative(process.cwd(), file)
    print.debug(
      `Test worker ${threadId}`,
      chalk.cyan(test.name),
      chalk.gray(filePath)
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
      const { getSnapshotState, toAsyncExec } = require('./lib')

      // Extend the expect with jest-snapshot to allow snapshot testing.
      expect.extend({
        toMatchInlineSnapshot,
        toMatchSnapshot,
        toThrowErrorMatchingInlineSnapshot,
        toThrowErrorMatchingSnapshot
      })
      expect.addSnapshotSerializer = addSerializer

      // Create the context object that provides data and utilities to tests.
      const context = {
        ...test,
        file,
        expect,
        fail (msg) {
          throw new Error(msg || `Manual failure in test '${test.name}'`)
        },
        pass () {
          context.passed = true
        }
      }

      try {
        // Load the test file and extract the test object.
        const { testFn } = require(file)[test.key]

        // Update expect's state with the snapshot state and the test name.
        expect.setState({
          assertionCalls: 0,
          snapshotState: getSnapshotState(file, updateSnapshot),
          currentTestName: context.name
        })

        // Execute each function with the test context exported by the files
        // configured to be called before each test.
        if (beforeEachFiles && beforeEachFiles.length) {
          await pSeries(beforeEachFiles.map(toAsyncExec(context)))
        }

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        await testFn(context)

        // Extract expect's state after running the test.
        const { suppressedErrors, assertionCalls } = expect.getState()

        // If there were no assertions executed, fail the test.
        if (!context.passed && assertionCalls === 0) {
          throw new Error(`No assertions in test '${context.name}'`)
        }

        // If expect has a suppressed error (e.g. a snapshot did not match)
        // then throw the error so that the test can be marked as having failed.
        if (suppressedErrors.length) {
          throw suppressedErrors[0]
        }

        const { snapshotState } = expect.getState()
        if (snapshotState.added || snapshotState.updated) {
          context.response = {
            counters: Array.from(snapshotState._counters),
            snapshots: {},
            added: snapshotState.added,
            updated: snapshotState.updated
          }
          for (let i = snapshotState._counters.get(context.name); i > 0; i--) {
            const key = utils.testNameToKey(context.name, i)
            context.response.snapshots[key] = snapshotState._snapshotData[key]
          }
        }
      } catch (err) {
        context.failed = err
      } finally {
        try {
          // Execute each function with the test context exported by the files
          // configured to be called after each test.
          if (afterEachFiles && afterEachFiles.length) {
            await pSeries(afterEachFiles.map(toAsyncExec(context)))
          }

          if (context.failed) {
            // Delete the matcher result property of the error since it can't be
            // sent over postMessage.
            delete context.failed.matcherResult

            reject(context.failed)
          } else {
            resolve(context.response)
          }
        } catch (err) {
          reject(err)
        }
      }
    })
  }
})
