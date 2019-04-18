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
        updateSnapshots: 'u',
        logLevel: 'l'
      }
    }
  })

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the _ (input) attribute to get rid of duplicate
  // data.
  config.tests = config._.length ? config._ : config.tests
  delete config._

  // Run the tests and wait for a response with the pass/fail counts.
  const { passed, failed, skipped } = await bff(config)

  // Log the results of running the tests.
  console.log('')
  print.info(`${passed} passed. ${failed} failed. ${skipped} skipped.`)

  // Exit with the failed test count as the exit code so that the process exits
  // with a non-zero code when tests have failed.
  process.exit(failed)
}

try {
  run()
} catch (err) {
  print.error(err)
}
