require('dotenv').config()

const { Print } = require('@ianwalter/print')

module.exports = class BrowserStackIntegration {
  constructor (context) {
    // Set up a print instance on the integration instance so it can be reused.
    this.print = new Print(context.log)
    this.print.debug('BrowserStack integration enabled')

    // Make BrowserStack the WebDriver backend if not already configured.
    if (!context.webdriver.hostname) {
      context.webdriver.protocol = 'https'
      context.webdriver.hostname = 'hub-cloud.browserstack.com'
      context.webdriver.port = 443
    }

    // Define the global capability options.
    this.options = {
      userName: process.env.BROWSERSTACK_USERNAME,
      accessKey: process.env.BROWSERSTACK_ACCESS_KEY
    }
  }

  static integrate (context) {
    if (context.webdriver.browserstack) {
      context.webdriver.integrations.push(new BrowserStackIntegration(context))
    }
  }

  enhanceCapability (testContext) {
    const options = {
      // Tell BrowserStack the name of the test.
      sessionName: testContext.key
    }
    testContext.capability['bstack:options'] = Object.assign(
      options,
      this.options,
      testContext.capability['bstack:options']
    )
  }

  async report ({ webdriver, testContext }) {
    try {
      const got = require('got')

      // Report the test result to BrowserStack via a HTTP call to the
      // BrowserStack API.
      const prefixUrl = 'https://api.browserstack.com/automate/sessions'
      const json = {
        name: testContext.key,
        status: testContext.result.failed ? 'error' : 'completed'
      }
      const auth = {
        username: this.options.userName,
        password: this.options.accessKey
      }
      const path = `${testContext.browser.sessionId}.json`
      await got.put(path, { prefixUrl, ...auth, json })

      // If the test failed, print the BrowserStack Dashboard URL for this
      // session to make it easier for the user to debug.
      if (testContext.result.failed) {
        const response = await got(path, { prefixUrl, ...auth, json: true })
        const url = response.body.automation_session.browser_url
        this.print.info('BrowserStack session:', url)
      }
    } catch (err) {
      this.print.error(err)
    }
  }
}
