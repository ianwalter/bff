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
        // Load the test file.
        const test = require(file)

        // Perform the given test within the test file and make the expect
        // assertion library available to it.
        await test[name]({
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
