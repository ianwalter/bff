#!/usr/bin/env node

// const meow = require('meow')
const { print } = require('@ianwalter/print')
const bff = require('.')

async function run () {
  // const cli = meow(
  //   `
  //   `,
  //   {

  //   }
  // )

  // Run the tests and wait for a response with the pass/fail counts.
  const { pass, fail } = await bff()

  // Log the results of running the tests.
  console.log('')
  print.info(`${pass} tests passed. ${fail} tests failed.`)

  // Exit with the failed test count as the exit code so that the process exits
  // with a non-zero code when tests have failed.
  process.exit(fail)
}

run()
