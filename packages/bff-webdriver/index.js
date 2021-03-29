import generatesLogger from '@generates/logger'
import { remote } from 'webdriverio'
import appium from './integrations/appium.js'
import cleanup from './cleanup.js'

export const webdriverVersion = '3.141.59'

const { createLogger } = generatesLogger
const logger = createLogger({ level: 'info', namespace: 'bff.webdriver' })

export default {
  webdriverVersion,
  async before (context) {
    try {
      // Set the WebDriver version if not already configured.
      context.webdriver.version = context.webdriver.version || webdriverVersion
      logger.debug('Using WebDriver version', context.webdriver.version)
    } catch (err) {
      logger.error(err)
    }
  },
  registration (_, context) {
    try {
      // Extract the WebDriver capabilities from the test configuration.
      const capabilities = Array.isArray(context.webdriver.capabilities)
        ? context.webdriver.capabilities
        : [context.webdriver.capabilities]

      // Go through the browser tests and split them up by capability so that
      // they can be run individually/in parallel.
      context.augmentTests = tests => tests.reduce(
        (acc, test) => acc.concat(capabilities.map(capability => {
          let name = test.name
          if (capabilities.length > 1) {
            // Modify the test name to contain the name of the browser it's
            // being tested in.
            name = `${test.name} in ${capability.browserName}`

            // Modify the test name to contain the version of the browser it's
            // being tested in, if configured.
            if (capability.browserVersion) {
              name += ` ${capability.browserVersion}`
            }
          }

          // Return the test with it's modified name and capability
          // configuration.
          return { ...test, name, capability }
        })),
        []
      )
    } catch (err) {
      logger.error(err)
    }
  },
  async beforeEach (_, context) {
    try {
      logger.debug('Adding WebDriver integrations')

      // Add enabled integrations to the integrations array so they can be used
      // later.
      context.webdriver.integrations = context.webdriver.integrations || []
      if (context.webdriver.appium) appium(context)

      // Go through each enabled integration and allow it to enahance the
      // webdriver capability.
      const enhanceCapability = i => i.enhanceCapability(context.testContext)
      context.webdriver.integrations.forEach(enhanceCapability)
    } catch (err) {
      logger.error(err)
    }

    try {
      logger.debug('Creating WebdriverIO browser instance')

      // Set up the browser instance and add it to the test context.
      context.testContext.browser = await remote({
        path: '/wd/hub',
        ...context.webdriver,
        logLevel: context.webdriver.logLevel || context.log.level,
        capabilities: context.testContext.capability
      })
    } catch (err) {
      logger.error(err)
    }
  },
  async afterEach (_, context) {
    try {
      // Go through each enabled integration and report results to it, etc.
      logger.debug('Running WebDriver integration reporting')
      const toReport = async integration => {
        if (integration.report) integration.report(context)
      }
      await Promise.all(context.webdriver.integrations.map(toReport))
    } catch (err) {
      logger.error(err)
    }

    try {
      if (context.testContext.browser) {
        // Tell Selenium to delete the browser session once the test is over.
        logger.debug('Terminating WebdriverIO browser instance')
        await context.testContext.browser.deleteSession()
      }
    } catch (err) {
      logger.error(err)
    }
  }
}
