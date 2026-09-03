import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  BROWSER_TEST_ENVIRONMENT_KEYS,
  BROWSER_TEST_MODE,
  validateBrowserTestSafety,
} from './src/firebase/browserTestSafety.js'

const browserTestVariableNames = Object.freeze(Object.values(BROWSER_TEST_ENVIRONMENT_KEYS))

export default defineConfig(({ command, mode }) => {
  if (mode === BROWSER_TEST_MODE) {
    const loadedEnvironment = loadEnv(mode, process.cwd(), '')
    const browserTestEnvironment = Object.fromEntries(browserTestVariableNames.map((name) => [
      name,
      process.env[name] ?? loadedEnvironment[name],
    ]))
    validateBrowserTestSafety({
      mode,
      production: command === 'build',
      environment: browserTestEnvironment,
    })
  }

  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                priority: 40,
              },
              {
                name: 'i18n',
                test: /node_modules[\\/](i18next|react-i18next)[\\/]/,
                priority: 25,
              },
            ],
          },
        },
      },
    },
  }
})
