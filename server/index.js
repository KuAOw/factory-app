const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// นำเข้า routes ของ materials และ users
const materialsRoutes = require('./routes/materials');
const usersRoutes = require('./routes/users');

const app = express();

// ใช้ helmet() เพื่อเพิ่ม security headers พื้นฐาน
app.use(helmet());
// เปิดให้ cross-origin resource sharing
app.use(cors());
// ให้ express แปลง JSON request body
app.use(express.json());

// หน้าแสดงสถานะ (HTML)
app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
  <html lang="th">
    <head>
      <meta charset="utf-8" />
      <title>Factory API Status</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; }
        body { margin: 2rem; line-height: 1.6; }
        .badge {
          display: inline-block; padding: .4rem .7rem; border-radius: .5rem;
          background: #fff3cd; color: #856404; border: 1px solid #ffeeba;
        }
        .ok { color: #155724; background: #d4edda; border: 1px solid #c3e6cb; padding:.4rem .6rem; border-radius:.4rem; }
        .muted { color:#6c757d; font-size:.9rem; }
        code { background:#f8f9fa; padding:.2rem .35rem; border-radius:.25rem; }
      </style>
    </head>
    <body>
      <h1>Factory API</h1>
      <p class="ok">✅ Server is running</p>
      <p><span class="badge">🚧 กำลังทดสอบ Users API</span></p>
      <hr />
      <p class="muted">
        Users endpoints: <code>/api/users/login</code>,
        <code>/api/users/me</code>, <code>/api/users</code> …
      </p>
    </body>
  </html>`);
});


// กำหนด rate limit เฉพาะ endpoints ที่เกี่ยวกับการ auth
// จำกัด 100 requests ต่อ 15 นาที ต่อ IP
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/users/login', authLimiter);
app.use('/api/users/refresh', authLimiter);

// เส้นทางสำหรับ materials และ users
app.use('/api/materials', materialsRoutes);
app.use('/api/users', usersRoutes);

// ให้บริการไฟล์ static (ถ้าต้องการ)
// app.use('/factory', express.static('public'));

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 3000;

app.listen(port, host, () => {
  console.log(`✅ Server running at http://${host}:${port}`);
});
