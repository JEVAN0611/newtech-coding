import React, { useState, useEffect } from 'react';
import ChatInterface from '../chat/ChatInterface';

function ScrollWebtoon() {
  const [visiblePanels, setVisiblePanels] = useState([]);

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      const panels = document.querySelectorAll('.webtoon-panel');
      const newVisiblePanels = [];

      panels.forEach((panel, index) => {
        const rect = panel.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible && !visiblePanels.includes(index)) {
          newVisiblePanels.push(index);
        }
      });

      if (newVisiblePanels.length > 0) {
        setVisiblePanels(prev => [...prev, ...newVisiblePanels]);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // 초기 실행

    return () => window.removeEventListener('scroll', handleScroll);
  }, [visiblePanels]);

  const panels = [
    {
      id: 1,
      image: '/assets/images/webtoon/panel1-daegu-station.jpg',
      alt: '대구역에 도착한 독자의 모습'
    },
    {
      id: 2, 
      image: '/assets/images/webtoon/panel2-daegu-appear.jpg',
      alt: '독자를 반기는 대구-대구 캐릭터'
    },
    {
      id: 3,
      image: '/assets/images/webtoon/panel3-daegu-running.jpg', 
      alt: '숨차게 달려오는 대구-대구'
    },
    {
      id: 4,
      image: '/assets/images/webtoon/panel4-daegu-question.jpg',
      alt: '이름을 묻는 대구-대구'
    },
    {
      id: 5,
      image: '/assets/images/webtoon/panel5-user-response.jpg',
      alt: '독자가 답변하는 컷'
    }
  ];

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* 웹툰 패널들 */}
      {panels.map((panel, index) => (
        <div
          key={panel.id}
          className="webtoon-panel"
          style={{
            margin: '50px 0',
            minHeight: '400px',
            opacity: visiblePanels.includes(index) ? 1 : 0,
            transform: visiblePanels.includes(index) 
              ? 'translateY(0)' 
              : 'translateY(50px)',
            transition: 'all 0.8s ease-in-out',
            border: '3px solid #333',
            borderRadius: '10px',
            backgroundColor: '#f9f9f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
        >
          {/* 임시 이미지 (나중에 실제 이미지로 교체) */}
          <div style={{
            width: '100%',
            height: '400px',
            backgroundImage: `url(${panel.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: '7px'
          }}>
            {/* 이미지가 없을 때 임시 표시 */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: '7px'
            }}>
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '20px' 
              }}>
                {index === 0 && '🚉'}
                {index === 1 && '🎭'}
                {index === 2 && '💨'}
                {index === 3 && '❓'}
                {index === 4 && '💬'}
              </div>
              <p style={{ 
                color: '#666', 
                textAlign: 'center',
                fontSize: '16px'
              }}>
                {panel.alt}
              </p>
              <p style={{
                color: '#999',
                fontSize: '12px',
                marginTop: '10px'
              }}>
                컷 {panel.id}/5
              </p>
            </div>
          </div>
        </div>
      ))}

{/* 5컷 모두 보였을 때 인터랙티브 섹션 */}
{visiblePanels.length >= 5 && (
  <div style={{
    marginTop: '80px',
    animation: 'fadeIn 1s ease-in-out'
  }}>
    <div style={{
      padding: '30px',
      border: '3px dashed #007acc',
      borderRadius: '15px',
      backgroundColor: '#f0f8ff',
      textAlign: 'center',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#007acc', marginBottom: '20px' }}>
        🎮 인터랙티브 웹툰 시작!
      </h3>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        이제부터 대구-대구와 실제로 AI 대화할 수 있어요!
      </p>
    </div>
    
    {/* 실제 AI 채팅 컴포넌트 */}
<ChatInterface />
  </div>
)}

    </div>  // ← 이 줄이 빠져있었어요!
  );
}

export default ScrollWebtoon;