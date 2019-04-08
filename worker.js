const { worker } = require('workerpool')
const expect = require('expect')

worker({
  async test (file, name) {
    const test = require(file)
    await test[name]({ expect })
    if (expect.getState().assertionCalls === 0) {
      throw new Error(`No assertions made in test '${name}'.`)
    }
  }
})
