const { test, bench } = require('..')

const stringBench = bench`String has single character`

test`RegExp#test ${stringBench} ${() => /o/.test('Hello World!')}`

test`String#indexOf ${stringBench} ${() => 'Hello World!'.indexOf('o') > -1}`

test`String#match ${stringBench} ${() => !!'Hello World!'.match(/o/)}`

test`String#includes ${stringBench} ${() => 'Hello World!'.includes('o')}`

// const benchSetup = setup(t => ...)
