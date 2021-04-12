import enhanceTestContext from './enhanceTestContext.js'
import { createLogger } from '@generates/logger'

export default function enhanceNodeTestContext (testContext) {
  // Enhance the test context with utilities that are not environment-dependent.
  enhanceTestContext(testContext)

  // Add a logger instance to the test context.
  testContext.logger = createLogger({ level: 'info', namespace: 'bff.test' })
}
