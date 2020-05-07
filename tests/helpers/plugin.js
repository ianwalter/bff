module.exports = {
  before (context) {
    context.beforeMessage = 'before was here'
  },
  registration (file, context) {
    context.augmentTests = tests => tests.reduce(
      (acc, test) => {
        if (test.key === 'registration') {
          return acc.concat([
            { ...test, name: 'registration [ONE]' },
            { ...test, name: 'registration [TWO]' }
          ])
        }
        return acc.concat([test])
      },
      []
    )
  },
  beforeEach (file, context) {
    context.beforeEachMessage = 'beforeEach was here'
  }
}
