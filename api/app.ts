import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './database.js'
import authRoutes from './routes/auth.js'
import meetingRoutes from './routes/meetings.js'
import taskRoutes from './routes/tasks.js'
import reportRoutes from './routes/reports.js'
import searchRoutes from './routes/search.js'
import logRoutes from './routes/logs.js'
import statsRoutes from './routes/stats.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth', authRoutes)
app.use('/api/meetings', meetingRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/stats', statsRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error.message)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export { app, initDatabase }
