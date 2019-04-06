const { worker } = require('workerpool')
const expect = require('expect')

worker({
  async test (file, name) {
    const test = require(file)
    return test[name]({ expect })
  }
})
