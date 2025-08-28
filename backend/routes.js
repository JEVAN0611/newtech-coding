const express = require('express');
const { chatWithDaegu } = require('./src/aiService');
const router = express.Router();

// AI 채팅 엔드포인트
router.post('/api/chat', async (req, res) => {
  try {
    const { message, userName } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '메시지가 필요합니다' });
    }

    const aiResponse = await chatWithDaegu(message, userName);
    
    if (aiResponse.success) {
      res.json({
        success: true,
        response: aiResponse.message,
        character: "대구-대구"
      });
    } else {
      res.json({
        success: false,
        response: aiResponse.fallback,
        character: "대구-대구"
      });
    }
  } catch (error) {
    console.error('채팅 API 에러:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다',
      response: "미안, 뭔가 문제가 생겼어! 다시 해볼래? 😅"
    });
  }
});

module.exports = router;