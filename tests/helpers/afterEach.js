const { print } = require('@ianwalter/print')

module.exports = function afterEach (hook, context) {
  if (hook !== 'afterEach') {
    throw new Error(
      `Hook name is incorrect, expecting 'afterEach', got`,
      `'${hook}'`
    )
  }

  if (context.testContext.name === 'afterEach') {
    print.log(
      'afterEach executed',
      context.beforeMessage,
      context.beforeEachMessage
    )
  }
}
