import { createLogger } from '@generates/logger'

const logger = createLogger({
  level: 'info',
  namespace: 'bff.webdriver.appium'
})

export default function appium (context) {
  logger.debug('Appium integration enabled')

  // Define the global capability options.
  context.webdriver.port = context.webdriver.port || 4723

  context.webdriver.integrations.push({
    enhanceCapability (testContext) {
      // Tell Appium the name of the test.
      const options = { sessionName: testContext.key }
      testContext.capability = Object.assign(options, testContext.capability)
    }
  })
}
