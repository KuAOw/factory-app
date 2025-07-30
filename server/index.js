const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ เส้นทางหลัก
app.get('/', (req, res) => {
  res.send('Factory API is running...');
});

// ✅ เส้นทางวัสดุ
app.use('/api/materials', require('./routes/materials'));

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
