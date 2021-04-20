export default function examplePlugin (plug) {
  plug.in('beforeRun', function example (ctx, next) {
    ctx.beforeMessage = 'before was here'
    return next()
  })

  plug.in('afterRegistration', function example (ctx, next) {
    ctx.file.tests = ctx.file.tests.reduce(
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

  plug.in('afterRun', function example (ctx, next) {
    ctx.beforeEachMessage = 'beforeEach was here'
    return next()
  })
}
