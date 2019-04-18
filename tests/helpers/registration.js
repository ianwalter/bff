module.exports = function registration (hook, context) {
  if (hook !== 'registration') {
    throw new Error(
      `Hook name is incorrect, expecting 'registration', got`,
      `'${hook}'`
    )
  }

  context.registrationContext.tests = context.registrationContext.tests.reduce(
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
