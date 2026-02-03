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
            const projectRoot = path.resolve(__dirname, '..')
            const venvPython = path.resolve(projectRoot, '.venv/bin/python')
            const results: { step: string; success: boolean; message?: string }[] = []
            
            try {
              // Step 1: Pull fresh data from sources
              console.log('\n📥 Step 1/2: Pulling fresh data from sources...')
              const refreshDataScript = path.resolve(projectRoot, 'scripts/refresh_data.py')
              
              try {
                const { stdout: pullStdout, stderr: pullStderr } = await execAsync(
                  `"${venvPython}" "${refreshDataScript}"`,
                  { cwd: projectRoot, timeout: 120000 }
                )
                console.log(pullStdout)
                if (pullStderr) console.error(pullStderr)
                results.push({ step: 'pull', success: true, message: 'Data pulled from sources' })
              } catch (pullError: unknown) {
                const pullErrorMsg = pullError instanceof Error ? pullError.message : 'Unknown error'
                console.error('⚠️ Warning: Could not pull fresh data:', pullErrorMsg)
                results.push({ step: 'pull', success: false, message: pullErrorMsg })
                // Continue to processing even if pull fails (use existing data)
              }
              
              // Step 2: Process data into dashboard.json
              console.log('\n⚙️ Step 2/2: Processing data into dashboard.json...')
              const processDataScript = path.resolve(__dirname, 'scripts/process_data.py')
              
              const { stdout: processStdout, stderr: processStderr } = await execAsync(
                `"${venvPython}" "${processDataScript}"`,
                { cwd: __dirname, timeout: 120000 }
              )
              
              console.log(processStdout)
              if (processStderr) console.error(processStderr)
              results.push({ step: 'process', success: true, message: 'Dashboard data generated' })
              
              // Determine overall success
              const pullSuccess = results.find(r => r.step === 'pull')?.success ?? false
              const processSuccess = results.find(r => r.step === 'process')?.success ?? false
              
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ 
                success: processSuccess,
                pullSuccess,
                processSuccess,
                message: pullSuccess 
                  ? 'Fresh data pulled and processed successfully'
                  : 'Processed existing data (pull failed or skipped)',
                results,
                timestamp: new Date().toISOString()
              }))
              
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              console.error('❌ Error during data refresh:', errorMessage)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ 
                success: false,
                pullSuccess: results.find(r => r.step === 'pull')?.success ?? false,
                processSuccess: false,
                error: errorMessage,
                results 
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
