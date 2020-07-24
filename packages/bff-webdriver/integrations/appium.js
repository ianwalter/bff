require('dotenv').config()

const { Print } = require('@ianwalter/print')

module.exports = class AppiumIntegration {
  constructor (context) {
    // Set up a print instance on the integration instance so it can be reused.
    this.print = new Print(context.log)
    this.print.debug('Appium integration enabled')

    // Define the global capability options.
    context.webdriver.port = context.webdriver.port || 4723
  }

  static integrate (context) {
    if (context.webdriver.appium) {
      context.webdriver.integrations.push(new AppiumIntegration(context))
    }
  }

  enhanceCapability (testContext) {
    const options = {
      // Tell appium the name of the test.
      sessionName: testContext.key
    }
    testContext.capability = Object.assign(options, testContext.capability)
  }
}
