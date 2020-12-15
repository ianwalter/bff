#!/usr/bin/env node

import cli from '@ianwalter/cli'
import { createLogger } from '@generates/logger'
import selenium from 'selenium-standalone.js'
import cleanup from './cleanup.js'
import { webdriverVersion } from './index.js'

const logger = createLogger({ level: 'info', namespace: 'bff.webdriver.cli' })

async function run () {
  const config = cli({ name: 'bff' })
  const { _: [command] } = config

  try {
    if (command === 'setup') {
      const { version = webdriverVersion, drivers } = config.webdriver || {}
      await new Promise((resolve, reject) => {
        selenium.install(
          { logger: logger.log.bind(logger), version, drivers },
          err => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      })
    } else if (command === 'cleanup') {
      await cleanup()
    } else {
      logger.error('Unknown command:', command)
      process.exit(1)
    }
  } catch (err) {
    logger.error(err)
  }
}

run()
