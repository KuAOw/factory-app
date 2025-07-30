# server/Dockerfile
FROM node:22-alpine

# กำหนด working directory
WORKDIR /app

# คัดลอกไฟล์ package ก่อน เพื่อใช้ cache
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอก source code ทั้งหมด
COPY . .

# เปิดพอร์ตที่ Express ใช้งาน
EXPOSE 3000

# คำสั่งรัน server
CMD ["node", "index.js"]
