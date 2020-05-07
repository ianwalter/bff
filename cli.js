#!/usr/bin/env node

const { promises: fs } = require('fs')
const path = require('path')
const cli = require('@ianwalter/cli')
const { print, chalk } = require('@ianwalter/print')
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
        description: "Specifies bff's print (logging) configuration",
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

  // Only run tests marked as failed in a JUnit file.
  if (config.failed) {
    const camaro = require('camaro')
    const file = typeof config.failed === 'string' ? config.failed : 'junit.xml'
    const xml = await fs.readFile(path.resolve(file), 'utf8')
    const template = { failed: ['//testcase[failure]', '@name'] }
    const { failed } = await camaro.transform(xml, template)
    print.write('\n')
    print.info(`Running failed tests in ${file}:`, '\n', failed.join('\n'))
    print.write('\n')
    config.failed = failed
  }

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the _ (input) attribute to get rid of duplicate
  // data.
  config.tests = config._.length ? config._ : config.tests
  delete config._

  // Run the tests and wait for a response with the passed/failed/skipped
  // counts.
  const passed = []
  const failed = []
  const warnings = []
  const skipped = []
  for (let runs = 0; runs < config.runs; runs++) {
    const result = await bff.run(config)

    // Add a blank line between the test output and result summary so it's
    // easier to spot.
    print.write('\n')

    // If there was an error thrown outside of the test functions (e.g.
    // requiring a module that wasn't found) then output a fatal error.
    if (result.err) {
      print.fatal(result.err)
      if (result.err instanceof bff.FailFastError) {
        print.write('\n')
      } else {
        process.exit(1)
      }
    }

    // Log the results of running the tests.
    print.info(
      chalk.green.bold(`${result.passed.length} passed.`),
      chalk.red.bold(`${result.failed.length} failed.`),
      chalk.yellow.bold(`${result.warnings.length} warnings.`),
      chalk.white.bold(`${result.skipped.length} skipped.`)
    )

    // Aggregate test results accross runs.
    passed.push(...result.passed)
    failed.push(...result.failed)
    warnings.push(...result.warnings)
    skipped.push(...result.skipped)

    // Add blank line after the result summary so it's easier to spot.
    print.write('\n')
  }

  // If configured, generate a junit XML report file based on the test results.
  if (config.junit) {
    const junitBuilder = require('junit-report-builder')

    // Determine the junit report file path.
    const junit = typeof config.junit === 'string' ? config.junit : 'junit.xml'

    // Group tests by test file so that the test file relative path can be used
    // as the suite name.
    const allTests = [...passed, ...failed, ...warnings, ...skipped]
    const files = allTests.reduce((acc, test) => {
      if (acc[test.file]) {
        acc[test.file].push(test)
      } else {
        acc[test.file] = [test]
      }
      return acc
    }, {})

    // Create a test for each test file and add the containing tests to the
    // suite as test cases.
    Object.entries(files).forEach(([file, tests]) => {
      const suite = junitBuilder.testSuite().name(file)
      tests.forEach(test => {
        const testCase = suite.testCase().name(test.name)
        if (test.skip || (test.err && test.warn)) {
          testCase.skipped()
        } else if (test.err) {
          testCase.failure(test.err)
        }
      })
    })

    // Write the junit report file to the filesystem.
    junitBuilder.writeTo(junit)
  }

  // If any tests failed, exit with a non-zero exit code.
  process.exit(failed.length ? 1 : 0)
}

run().catch(err => {
  print.write('\n')
  print.fatal(err)
  process.exit(1)
})
