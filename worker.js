const { worker } = require('workerpool')
const expect = require('expect')

worker({
  register (file) {
    // Return all of the names of the tests exported by the test file.
    return Object.keys(require(file))
  },
  test (file, name) {
    return new Promise(async (resolve, reject) => {
      try {
        // Load the test file and extract the test object.
        const tests = require(file)
        const { test, skip } = tests[name]

        // Don't execute the test if it's marked with a skip modifier.
        if (skip) {
          return resolve({ skip: true })
        }

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        await test({
          expect,
          fail: r => reject(r || new Error(`Manual failure in test '${name}'`)),
          pass: resolve
        })

        // If there were no assertions executed, fail the test.
        if (expect.getState().assertionCalls === 0) {
          throw new Error(`No assertions in test '${name}'`)
        }

        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }
})
