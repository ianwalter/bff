#!/usr/bin/env node

const cli = require('@ianwalter/cli')
const { print, chalk } = require('@ianwalter/print')
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
        junit: 'j',
        match: 'm',
        performance: 'p'
      },
      boolean: ['p']
    }
  })

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the _ (input) attribute to get rid of duplicate
  // data.
  config.tests = config._.length ? config._ : config.tests
  delete config._

  // Run the tests and wait for a response with the passed/failed/skipped
  // counts.
  const { err, passed, failed, warnings, skipped } = await bff.run(config)

  // Add a blank line between the test output and result summary so it's easier
  // to spot.
  print.write('\n')

  // If there was an error thrown outside of the test functions (e.g. requiring
  // a module that wasn't found) then output a fatal error.
  if (err) {
    print.fatal(err)
    if (err instanceof bff.FailFastError) {
      print.write('\n')
    } else {
      process.exit(1)
    }
  }

  // Log the results of running the tests.
  print.info(
    chalk.green.bold(`${passed.length} passed.`),
    chalk.red.bold(`${failed.length} failed.`),
    chalk.yellow.bold(`${warnings.length} warnings.`),
    chalk.white.bold(`${skipped.length} skipped.`)
  )

  // Add blank line after the result summary so it's easier to spot.
  print.write('\n')

  // If configured, generate a junit XML report file based on the test results.
  if (config.junit) {
    const junitBuilder = require('junit-report-builder')

    // Determine the junit report file path.
    const junit = typeof config.junit === 'string' ? config.junit : 'junit.xml'

    // Group tests by test file so that the test file relative path can be used
    // as the suite name.
    const files = [...passed, ...failed, ...skipped].reduce((acc, test) => {
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
        if (test.err) {
          testCase.failure(test.err)
        } else if (test.skip) {
          testCase.skipped()
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
