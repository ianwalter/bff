#!/usr/bin/env node

const cli = require('@ianwalter/cli')
const { print } = require('@ianwalter/print')
const bff = require('.')

async function run () {
  const config = cli({
    name: 'bff',
    opts: {
      alias: {
        concurrency: 'c',
        updateSnapshot: 'u',
        logLevel: 'l',
        tags: 't',
        timeout: 'T',
        failFast: 'f',
        puppeteer: 'p'
      }
    }
  })

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the _ (input) attribute to get rid of duplicate
  // data.
  config.tests = config._.length ? config._ : config.tests
  delete config._

  // Run the tests and wait for a response with the passed/failed/skipped
  // counts.
  const { passed, failed, skipped } = await bff.run(config)

  // Log the results of running the tests.
  process.stdout.write('\n')
  print.info(
    `${passed.length} passed.`,
    `${failed.length} failed.`,
    `${skipped.length} skipped.`
  )

  // If any tests failed, exit with a non-zero exit code.
  process.exit(failed.length ? 1 : 0)
}

try {
  run()
} catch (err) {
  print.error(err)
  process.exit(1)
}
