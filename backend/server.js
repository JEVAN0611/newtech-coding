const express = require("express");
const cors = require("cors");
const routes = require("./routes"); // ← 이 줄 추가!
require("dotenv").config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(routes); // ← 이 줄 추가!

// 테스트 API (기존 유지)
app.get("/api/test", (req, res) => {
  res.json({
    message: "대구 웹툰 API 서버 작동중! 🎭",
    character: "대구-대구가 인사해요!",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행중입니다`);
});
