const util = require('util')
const { test, bench } = require('..')
const { Print } = require('@ianwalter/print')

const print = new Print({ stream: false })
const stringBench = bench`String has single character`

test`RegExp#test ${stringBench} ${() => /o/.test('Hello World')}`

test`String#indexOf ${stringBench} ${() => 'Hello World'.indexOf('o') > -1}`

test`String#match ${stringBench} ${() => !!'Hello World'.match(/o/)}`

test`String#includes ${stringBench} ${() => 'Hello World'.includes('o')}`

// const benchSetup = setup(t => ...)

test`print.log ${bench``} ${() => print.log('Hello World')}`

const fisBench = bench`Float to integer string`

test`Math#round ${fisBench} ${() => Math.round(2.65).toString()}`

test`Float#toFixed ${fisBench} ${() => (2.65).toFixed()}`

test`util.inspect ${bench``} ${() => util.inspect(fisBench)}`
