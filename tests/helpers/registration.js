module.exports = function registration (context) {
  context.tests = context.tests.reduce(
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
}
