const { print } = require('@ianwalter/print')

module.exports = function before (context) {
  context.msg = 'with context'
  print.log('before executed')
}
