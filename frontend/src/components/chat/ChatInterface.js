import React, { useState } from 'react';

function ChatInterface({ onNameSubmit }) {
  const [userName, setUserName] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNameSubmitted, setIsNameSubmitted] = useState(false);

  // 이름 제출
  const handleNameSubmit = async () => {
    if (!userName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `안녕하세요! 제 이름은 ${userName}입니다.`,
          userName: userName
        }),
      });

      const data = await response.json();
      
      setChatHistory([
        { speaker: '나', message: `안녕하세요! 제 이름은 ${userName}입니다.` },
        { speaker: '대구-대구', message: data.response }
      ]);
      
      setIsNameSubmitted(true);
      if (onNameSubmit) onNameSubmit(userName);
    } catch (error) {
      console.error('API 호출 에러:', error);
      setChatHistory([
        { speaker: '나', message: `안녕하세요! 제 이름은 ${userName}입니다.` },
        { speaker: '대구-대구', message: '앗, 연결에 문제가 있어! 다시 해볼래? 😅' }
      ]);
    }
    setIsLoading(false);
  };

  // 메시지 전송
  const handleMessageSend = async () => {
    if (!currentMessage.trim()) return;

    const userMsg = currentMessage;
    setCurrentMessage('');
    
    // 사용자 메시지 추가
    setChatHistory(prev => [...prev, { speaker: '나', message: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMsg,
          userName: userName
        }),
      });

      const data = await response.json();
      
      // AI 응답 추가
      setChatHistory(prev => [...prev, { speaker: '대구-대구', message: data.response }]);
    } catch (error) {
      console.error('API 호출 에러:', error);
      setChatHistory(prev => [...prev, { 
        speaker: '대구-대구', 
        message: '미안, 뭔가 문제가 생겼어! 다시 해볼래? 😅' 
      }]);
    }
    setIsLoading(false);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '3px solid #007acc',
      borderRadius: '15px',
      padding: '25px',
      marginTop: '20px',
      maxWidth: '500px',
      margin: '20px auto'
    }}>
      <h3 style={{ color: '#007acc', textAlign: 'center', marginBottom: '20px' }}>
        🎮 대구-대구와 실시간 채팅!
      </h3>

      {/* 이름 입력 섹션 */}
      {!isNameSubmitted && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ marginBottom: '15px', fontWeight: 'bold' }}>
            대구-대구: 이름이 뭐야? 😊
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <input 
              type="text" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="여기에 이름을 입력해주세요"
              style={{
                padding: '10px',
                border: '2px solid #ddd',
                borderRadius: '5px',
                fontSize: '16px',
                flex: 1,
                maxWidth: '200px'
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
            />
            <button 
              onClick={handleNameSubmit}
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: isLoading ? '#ccc' : '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {isLoading ? '...' : '만나기'}
            </button>
          </div>
        </div>
      )}

      {/* 채팅 히스토리 */}
      {chatHistory.length > 0 && (
        <div style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid #eee',
          borderRadius: '10px',
          padding: '15px',
          marginBottom: '15px',
          backgroundColor: '#f9f9f9'
        }}>
          {chatHistory.map((chat, index) => (
            <div key={index} style={{
              marginBottom: '10px',
              textAlign: chat.speaker === '나' ? 'right' : 'left'
            }}>
              <div style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: '10px',
                maxWidth: '80%',
                backgroundColor: chat.speaker === '나' ? '#007acc' : '#e9e9e9',
                color: chat.speaker === '나' ? 'white' : 'black'
              }}>
                <strong>{chat.speaker}:</strong> {chat.message}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ textAlign: 'left', color: '#666' }}>
              대구-대구가 생각 중... 💭
            </div>
          )}
        </div>
      )}

      {/* 메시지 입력 (이름 입력 후) */}
      {isNameSubmitted && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            placeholder="대구-대구에게 메시지를 보내세요..."
            style={{
              flex: 1,
              padding: '10px',
              border: '2px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleMessageSend()}
          />
          <button 
            onClick={handleMessageSend}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              backgroundColor: isLoading ? '#ccc' : '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            전송
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatInterface;