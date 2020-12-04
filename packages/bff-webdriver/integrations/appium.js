require('dotenv').config()

const { createLogger } = require('@generates/logger')

const logger = createLogger({
  level: 'info',
  namespace: 'bff-webdriver.appium'
})

module.exports = class AppiumIntegration {
  constructor (context) {
    logger.debug('Appium integration enabled')

    // Define the global capability options.
    context.webdriver.port = context.webdriver.port || 4723
  }

  static integrate (context) {
    if (context.webdriver.appium) {
      context.webdriver.integrations.push(new AppiumIntegration(context))
    }
  }

  enhanceCapability (testContext) {
    // Tell appium the name of the test.
    const options = { sessionName: testContext.key }
    testContext.capability = Object.assign(options, testContext.capability)
  }
}
