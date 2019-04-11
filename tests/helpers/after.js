const { print } = require('@ianwalter/print')

module.exports = function after (context) {
  print.log('after executed', context.msg)
}
