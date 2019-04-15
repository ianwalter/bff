#!/usr/bin/env node

const cli = require('@ianwalter/cli')
const { print } = require('@ianwalter/print')
const { run: bff } = require('.')

async function run () {
  const config = cli({
    name: 'bff',
    opts: {
      alias: {
        concurrency: 'c',
        updateSnapshot: 'u'
      }
    }
  })

  // Run the tests and wait for a response with the pass/fail counts.
  const { pass, fail, skip } = await bff(config)

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
