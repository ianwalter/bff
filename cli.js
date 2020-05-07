#!/usr/bin/env node

const cli = require('@ianwalter/cli')
const { print } = require('@ianwalter/print')
const bff = require('.')

// Set stdout to blocking so that the program doesn't exit with log statements
// still waiting to be printed to the console.
if (process.stdout._handle) {
  process.stdout._handle.setBlocking(true)
}

async function run () {
  const config = cli({
    name: 'bff',
    usage: 'bff [path-to-tests] [options]',
    options: {
      concurrency: {
        alias: 'c',
        arg: '<number>',
        description: 'Specifies how many tests/workers to run in parallel'
      },
      updateSnapshot: {
        alias: 'u',
        description: 'Specifies whether snapshots should be created or updated',
        default: false
      },
      log: {
        alias: 'l',
        description: "Specifies bff's logging level",
        default: { level: 'info' }
      },
      tag: {
        alias: 't',
        arg: '<tag>',
        description: `
          Specifies which test tags should be used to match tests. How it
          matches the tags depends on the \`match\` option below
        `
      },
      timeout: {
        alias: 'T',
        arg: '<milliseconds>',
        description: `
          Specifies how long a test should take in milliseconds before it's
          marked as failed for timing out
        `,
        default: 60000
      },
      failFast: {
        alias: 'f',
        description: `
          Specifies whether to exit when a test fails instead of continuing to
          run tests
        `,
        default: false
      },
      junit: {
        alias: 'j',
        arg: '[path]',
        description: `
          Specifies whether or not to write the results to a junit report file
          and optionally the relative path of the file
        `
      },
      match: {
        alias: 'm',
        arg: '<type>',
        description: `
          Specifies whether a test needs \`some\` or \`every\` specified tag in
          order for it to be run
        `,
        default: 'some'
      },
      verbose: {
        alias: 'V',
        description: `
          Prints more information for each test: test tags, relative file path,
          and timing information
        `,
        default: false
      },
      runs: {
        alias: 'r',
        arg: '<count>',
        description: 'Specifies the number of test runs to execute',
        default: 1
      },
      failed: {
        alias: 'F',
        arg: '[junit file]',
        description: `
          Only run tests marked as failed in ./junit.xml (or specified file)
        `
      }
    }
  })

  if (config.help) {
    return print.info(config.helpText)
  }

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the _ (input) attribute to get rid of duplicate
  // data.
  config.tests = config._.length ? config._ : config.tests
  delete config._

  const { fail } = await bff.run(config)

  // If any tests failed, exit with a non-zero exit code.
  process.exit(fail.length ? 1 : 0)
}

run().catch(err => {
  print.write('\n')
  print.fatal(err)
  process.exit(1)
})
