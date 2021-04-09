#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import cli from '@generates/cli'
import generatesLogger from '@generates/logger'
import camaro from 'camaro'
import junitBuilder from 'junit-report-builder'
import * as bff from './index.js'

// Set stdout to blocking so that the program doesn't exit with log statements
// still waiting to be logged to the console.
if (process.stdout._handle) process.stdout._handle.setBlocking(true)

const { createLogger, chalk } = generatesLogger
const logger = createLogger({ namespace: 'bff.cli', level: 'info' })

async function run () {
  const input = cli({
    name: 'bff',
    usage: 'bff [path-to-tests] [options]',
    options: {
      concurrency: {
        aliases: ['c'],
        arg: '<number>',
        description: 'Specifies how many tests/workers to run in parallel'
      },
      updateSnapshot: {
        aliases: ['u'],
        description: 'Specifies whether snapshots should be created or updated',
        default: false
      },
      log: {
        aliases: ['l'],
        description: 'Specifies logging configuration',
        default: { namespace: 'bff.main', level: 'info' }
      },
      tag: {
        aliases: ['t'],
        arg: '<tag>',
        description: `
          Specifies which test tags should be used to match tests. How it
          matches the tags depends on the \`match\` option below
        `
      },
      timeout: {
        aliases: ['T'],
        arg: '<milliseconds>',
        description: `
          Specifies how long a test should take in milliseconds before it's
          marked as failed for timing out
        `,
        default: 60000
      },
      failFast: {
        aliases: ['f'],
        description: `
          Specifies whether to exit when a test fails instead of continuing to
          run tests
        `,
        default: false
      },
      junit: {
        aliases: ['j'],
        arg: '[path]',
        description: `
          Specifies whether or not to write the results to a junit report file
          and optionally the relative path of the file
        `
      },
      match: {
        aliases: ['m'],
        arg: '<type>',
        description: `
          Specifies whether a test needs \`some\` or \`every\` specified tag in
          order for it to be run
        `,
        default: 'some'
      },
      verbose: {
        aliases: ['V'],
        description: `
          Logs more information for each test: test tags, relative file path,
          and timing information
        `,
        default: false
      },
      runs: {
        aliases: ['r'],
        arg: '<count>',
        description: 'Specifies the number of test runs to execute',
        default: 1
      },
      failed: {
        aliases: ['F'],
        arg: '[junit file]',
        description: `
          Only run tests marked as failed in ./junit.xml (or specified file)
        `
      }
    }
  })

  if (input?.helpText) {
    process.stdout.write('\n')
    logger.info(input.helpText)
    process.stdout.write('\n')
    process.exit(0)
  }

  // Only run tests marked as failed in a JUnit file.
  if (input.failed) {
    const file = typeof input.failed === 'string' ? input.failed : 'junit.xml'
    const xml = await fs.readFile(path.resolve(file), 'utf8')
    const template = { failed: ['//testcase[failure]', '@name'] }
    const { failed } = await camaro.transform(xml, template)
    process.stdout.write('\n')
    logger.info(`Running failed tests in ${file}:`, '\n', failed.join('\n'))
    process.stdout.write('\n')
    input.failed = failed
  }

  // Set tests as whatever paths were passed as input to the CLI or whatever
  // is configured and delete the args attribute to get rid of duplicate data.
  input.tests = input.args.length ? input.args : input.tests
  delete input.args

  // Run the tests and wait for a response with the passed/failed/skipped
  // counts.
  const passed = []
  const failed = []
  const warnings = []
  const skipped = []
  for (let runs = 0; runs < input.runs; runs++) {
    const result = await bff.run(input)

    // Add a blank line between the test output and result summary so it's
    // easier to spot.
    process.stdout.write('\n')

    // If there was an error thrown outside of the test functions (e.g.
    // requiring a module that wasn't found) then output a fatal error.
    if (result.err) {
      logger.fatal(result.err)
      if (result.err instanceof bff.FailFastError) {
        process.stdout.write('\n')
      } else {
        process.exit(1)
      }
    }

    // Log the results of running the tests.
    logger.info(
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
    process.stdout.write('\n')
  }

  // If configured, generate a junit XML report file based on the test results.
  if (input.junit) {
    // Determine the junit report file path.
    const junit = typeof input.junit === 'string' ? input.junit : 'junit.xml'

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
    junitBuilder.writeTo(path.resolve(junit))
  }

  // If any tests failed, exit with a non-zero exit code.
  process.exit(failed.length ? 1 : 0)
}

run().catch(err => {
  process.stdout.write('\n')
  logger.fatal(err)
  process.exit(1)
})
