const { print } = require('@ianwalter/print')

module.exports = function before (hook, context) {
  if (hook !== 'before') {
    throw new Error(
      `Hook name is incorrect, expecting 'before', got`,
      `'${hook}'`
    )
  }

  context.beforeMessage = 'before was here'

  print.log('before executed')
}
