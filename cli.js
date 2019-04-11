#!/usr/bin/env node

const meow = require('meow')
const { print } = require('@ianwalter/print')
const { run: bff } = require('.')

async function run () {
  const cli = meow(
    `
      Usage
        bff <filename/glob?>

      Examples
        bff
        ✅  cloning an Array
        ✅  clone has Object setter when proto is true
        ✅  cloning Vuex store state when proto is false

        💁  3 tests passed. 0 tests failed.
    `
  )

  // Run the tests and wait for a response with the pass/fail counts.
  const { pass, fail, skip } = await bff({
    tests: cli.input.length ? cli.input : undefined,
    pkg: cli.pkg
  })

  // Log the results of running the tests.
  console.log('')
  print.info(`${pass} passed. ${fail} failed. ${skip} skipped.`)

  // Exit with the failed test count as the exit code so that the process exits
  // with a non-zero code when tests have failed.
  process.exit(fail)
}

try {
  run()
} catch (err) {
  print.error(err)
}
