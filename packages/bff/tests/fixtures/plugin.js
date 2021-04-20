export default function examplePlugin (plug) {
  plug.in('beforeRun', function example (context, next) {
    context.beforeMessage = 'before was here'
    return next()
  })

  plug.in('registration', function example (context, next) {
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
    return next()
  })

  plug.in('afterRun', function example (context, next) {
    context.beforeEachMessage = 'beforeEach was here'
    return next()
  })
}
