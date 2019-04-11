const { worker } = require('workerpool')
const expect = require('expect')
const pSeries = require('p-series')
const { toAsyncExec } = require('./utilities')

worker({
  register (file) {
    // Return all of the names of the tests exported by the test file.
    return Object.keys(require(file))
  },
  test (file, name, beforeEachFiles, afterEachFiles) {
    return new Promise(async (resolve, reject) => {
      // Create the context object that provides data and utilities to tests.
      const context = {
        file,
        name,
        expect,
        fail (msg) {
          throw new Error(msg || `Manual failure in test '${name}'`)
        },
        pass: resolve
      }

      try {
        // Load the test file and extract the test object.
        const tests = require(file)
        const { test, skip, only } = tests[name]

        // Don't execute the test if it's marked with a skip modifier.
        if (skip) {
          return resolve({ skip: true })
        }

        // Don't execute the test if there is a test in the test file marked
        // with the only modifier and it's not this test.
        if (!only && Object.values(tests).some(test => test.only)) {
          return resolve({ excluded: true })
        }

        // Execute each function with the test context exported by the files
        // configured to be called before each test.
        if (beforeEachFiles && beforeEachFiles.length) {
          await pSeries(beforeEachFiles.map(toAsyncExec(context)))
        }

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        await test(context)

        // If there were no assertions executed, fail the test.
        if (expect.getState().assertionCalls === 0) {
          throw new Error(`No assertions in test '${name}'`)
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
