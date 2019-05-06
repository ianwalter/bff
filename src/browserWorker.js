import workerpool from 'workerpool'
import expect from 'expect'
import {
  addSerializer,
  toMatchSnapshot,
  toMatchInlineSnapshot,
  toThrowErrorMatchingSnapshot,
  toThrowErrorMatchingInlineSnapshot
} from 'jest-snapshot'
import { createTestContext, runTest } from './lib'

// Extend the expect with jest-snapshot to allow snapshot testing.
expect.extend({
  toMatchInlineSnapshot,
  toMatchSnapshot,
  toThrowErrorMatchingInlineSnapshot,
  toThrowErrorMatchingSnapshot
})
expect.addSnapshotSerializer = addSerializer

workerpool.worker({
  async test (context, fileContext, test) {
    console.debug('Test worker', test.name, '(Puppeteer)')

    // Create the context object that provides data and utilities to tests.
    const testContext = createTestContext(context, fileContext, test, expect)

    // TODO:
    const tests = await import(fileContext.file)
    const { testFn } = tests[test.key]

    // TODO:
    await runTest(testContext, testFn, context.timeout)

    // TODO:
    return testContext.result
  }
})
