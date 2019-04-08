const { worker } = require('workerpool')
const expect = require('expect')

worker({
  async test (file, name) {
    // Load the test file.
    const test = require(file)

    // Perform the given test within the test file and make the expect assertion
    // library available to it.
    await test[name]({ expect })

    // If there were no assertions executed, fail the test.
    if (expect.getState().assertionCalls === 0) {
      throw new Error(`No assertions made in test '${name}'`)
    }
  }
})
