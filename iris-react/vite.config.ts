import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    // Custom plugin for local data refresh API
    {
      name: 'data-refresh-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/refresh' && req.method === 'POST') {
            console.log('\n🔄 Refreshing data from source files...')
            
            try {
              // Run the Python data processing script
              const projectRoot = path.resolve(__dirname, '..')
              const scriptPath = path.resolve(__dirname, 'scripts/process_data.py')
              const venvPython = path.resolve(projectRoot, '.venv/bin/python')
              
              const { stdout, stderr } = await execAsync(`"${venvPython}" "${scriptPath}"`, {
                cwd: __dirname,
                timeout: 120000, // 2 minute timeout
              })
              
              console.log(stdout)
              if (stderr) console.error(stderr)
              
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ 
                success: true, 
                message: 'Data refreshed successfully',
                timestamp: new Date().toISOString()
              }))
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              console.error('❌ Error refreshing data:', errorMessage)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ 
                success: false, 
                error: errorMessage 
              }))
            }
          } else if (req.url === '/api/refresh' && req.method === 'OPTIONS') {
            // Handle CORS preflight
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            res.end()
          } else {
            next()
          }
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
