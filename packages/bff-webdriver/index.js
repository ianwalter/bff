import generatesLogger from '@generates/logger'
import { remote } from 'webdriverio'
import appium from './integrations/appium.js'

const { createLogger } = generatesLogger
const logger = createLogger({ level: 'info', namespace: 'bff.webdriver' })

export default function webdriverPlugin (plug) {
  plug.in('afterRegistration', function webdriver (ctx, next) {
    try {
      // Extract the WebDriver capabilities from the test configuration.
      const capabilities = Array.isArray(ctx.webdriver.capabilities)
        ? ctx.webdriver.capabilities
        : [ctx.webdriver.capabilities]

      // Go through the browser tests and split them up by capability so that
      // they can be run individually/in parallel.
      ctx.file.tests = ctx.file.tests.reduce(
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
    return next()
  })

  plug.in('beforeTest', async function webdriver (ctx, next) {
    try {
      logger.debug('Adding WebDriver integrations')

      // Add enabled integrations to the integrations array so they can be used
      // later.
      ctx.webdriver.integrations = ctx.webdriver.integrations || []
      if (ctx.webdriver.appium) appium(ctx)

      // Go through each enabled integration and allow it to enahance the
      // webdriver capability.
      const enhanceCapability = i => i.enhanceCapability(ctx.testContext)
      ctx.webdriver.integrations.forEach(enhanceCapability)
    } catch (err) {
      logger.error(err)
    }

    try {
      logger.debug('Creating WebdriverIO browser instance')

      // Set up the browser instance and add it to the test context.
      ctx.testContext.browser = await remote({
        path: '/wd/hub',
        ...ctx.webdriver,
        logLevel: ctx.webdriver.logLevel || ctx.log.level,
        capabilities: ctx.testContext.capability
      })
    } catch (err) {
      logger.error(err)
    }

    return next()
  })

  plug.in('afterTest', async function webdriver (ctx, next) {
    try {
      // Go through each enabled integration and report results to it, etc.
      logger.debug('Running WebDriver integration reporting')
      const toReport = async integration => {
        if (integration.report) integration.report(ctx)
      }
      await Promise.all(ctx.webdriver.integrations.map(toReport))
    } catch (err) {
      logger.error(err)
    }

    try {
      if (ctx.testContext.browser) {
        // Tell Selenium to delete the browser session once the test is over.
        logger.debug('Terminating WebdriverIO browser instance')
        await ctx.testContext.browser.deleteSession()
      }
    } catch (err) {
      logger.error(err)
    }

    return next()
  })
}
