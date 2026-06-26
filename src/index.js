require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth',    require('./routes/auth'))
app.use('/api/users',   require('./routes/users'))
app.use('/api/sites',   require('./routes/sites'))
app.use('/api/devices', require('./routes/devices'))
app.use('/api/tickets', require('./routes/tickets'))
app.use('/api/reports', require('./routes/reports'))

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`✅ SCCT Backend chạy tại http://localhost:${PORT}`))
