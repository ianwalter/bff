const { print } = require('@ianwalter/print')

module.exports = function beforeEach (hook, context) {
  if (hook !== 'beforeEach') {
    throw new Error(
      `Hook name is incorrect, expecting 'beforeEach', got`,
      `'${hook}'`
    )
  }

  context.beforeEachMessage = 'beforeEach was here'

  if (context.testContext.name === 'beforeEach') {
    print.log('beforeEach executed', context.beforeMessage)
  }
}
