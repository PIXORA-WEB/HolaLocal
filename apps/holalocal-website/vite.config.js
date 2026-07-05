import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
              name: 'firebase-firestore',
              test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)/,
              priority: 35,
            },
            {
              name: 'firebase-storage',
              test: /node_modules[\\/](@firebase[\\/]storage|firebase[\\/]storage)/,
              priority: 35,
            },
            {
              name: 'firebase-auth',
              test: /node_modules[\\/](@firebase[\\/](auth|app|component|util|logger)|firebase[\\/](auth|app))/,
              priority: 30,
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
})
