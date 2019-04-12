const { join, dirname, basename } = require('path')
const { worker } = require('workerpool')
const expect = require('expect')
const pSeries = require('p-series')
const { toAsyncExec } = require('./utilities')
const {
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  SnapshotState
} = require('jest-snapshot')

expect.extend({
  toMatchInlineSnapshot,
  toMatchSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  toThrowErrorMatchingSnapshot
})
expect.addSnapshotSerializer = addSerializer

worker({
  register (file, registration) {
    return new Promise(async (resolve, reject) => {
      try {
        // Return all of the names of the tests exported by the test file.
        const names = Object.keys(require(file))
        const context = { tests: names.map(name => ({ key: name, name })) }

        if (registration && registration.length) {
          await pSeries(registration.map(toAsyncExec(context)))
        }

        resolve(context.tests)
      } catch (err) {
        reject(err)
      }
    })
  },
  test (file, test, beforeEachFiles, afterEachFiles, updateSnapshot) {
    return new Promise(async (resolve, reject) => {
      // Create the context object that provides data and utilities to tests.
      const context = {
        ...test,
        file,
        expect,
        fail (msg) {
          throw new Error(msg || `Manual failure in test '${test.name}'`)
        },
        pass: resolve
      }

      try {
        // Load the test file and extract the test object.
        const tests = require(file)
        const { testFn, skip, only } = tests[test.key]

        // Don't execute the test if it's marked with a skip modifier.
        if (skip) {
          return resolve({ skip: true })
        }

        // Don't execute the test if there is a test in the test file marked
        // with the only modifier and it's not this test.
        if (!only && Object.values(tests).some(test => test.only)) {
          return resolve({ excluded: true })
        }

        //
        const snapshotsDir = join(dirname(file), 'snapshots')
        const snapshotFilename = basename(file).replace('.js', '.snap')
        const snapshotPath = join(snapshotsDir, snapshotFilename)
        context.snapshot = new SnapshotState(snapshotPath, { updateSnapshot })
        expect.setState({
          snapshotState: context.snapshot,
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
        if (assertionCalls === 0) {
          throw new Error(`No assertions in test '${test.name}'`)
        }

        // If expect has a suppressed error (e.g., a snapshot did not match)
        // then throw the error so that the test can be marked as having failed.
        if (suppressedErrors.length) {
          throw suppressedErrors[0]
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

          // If the test failed before the snapshot was matched, mark it as
          // checked so that jest-snapshot doesn't think it's obsolete.
          if (context.failed) {
            context.snapshot.markSnapshotsAsCheckedForTest(context.name)
          }

          // The snapshot tests that weren't checked are obsolete and can be
          // removed from the snpashot tests.
          if (context.snapshot.getUncheckedCount()) {
            context.snapshot.removeUncheckedKeys()
          }

          // Save the snapshot changes.
          context.snapshot.save()

          if (context.failed) {
            reject(context.failed)
          } else {
            resolve()
          }
        } catch (err) {
          reject(err)
        }
      }
    })
  }
})
