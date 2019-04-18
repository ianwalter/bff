const { print } = require('@ianwalter/print')

module.exports = function after (hook, context) {
  if (hook !== 'after') {
    throw new Error(
      `Hook name is incorrect, expecting 'after', got`,
      `'${hook}'`
    )
  }

  print.log('after executed', context.beforeMessage)
}
