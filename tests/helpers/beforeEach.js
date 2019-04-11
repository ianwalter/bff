const { print } = require('@ianwalter/print')

module.exports = function beforeEach (context) {
  if (context.name === 'beforeEach') {
    print.log('beforeEach executed')
  }
}
