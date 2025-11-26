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
    { id: 1, image: '/assets/images/webtoon/main-0.jpg', alt: '대구역 풍경 — 시작!' },
    { id: 2, image: '/assets/images/webtoon/main-1.jpg', alt: '대구-대구 등장!' },
    { id: 3, image: '/assets/images/webtoon/main-2.jpg', alt: '반가워! 오늘 뭐 하고 싶어?' },
    { id: 4, image: '/assets/images/webtoon/main-3.jpg', alt: '동성로/달성공원/수성못 중 골라봐!' },
    { id: 5, image: '/assets/images/webtoon/main-4.jpg', alt: '취향대로 추천해줄게' },
    { id: 6, image: '/assets/images/webtoon/main-5.jpg', alt: '가볍게 둘러보고 결정하자' },
    { id: 7, image: '/assets/images/webtoon/main-6.jpg', alt: '대구-대구가 안내해줄게' },
    { id: 8, image: '/assets/images/webtoon/main-7.jpg', alt: '이제 아래서 대화 시작!' },
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
            width: '100%',
            boxSizing: 'border-box',
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
          {/* 배경 이미지 패널 (텍스트/이모티콘 오버레이 제거) */}
          <div style={{
            width: '100%',
            height: '400px',
            backgroundImage: `url("${panel.image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: '7px'
          }}>
            {/* 내용 없음: 순수 이미지만 노출 */}
          </div>
        </div>
      ))}

{/* 5컷 모두 보였을 때 챗 인터페이스 노출 */}
{visiblePanels.length >= panels.length && (
  <div style={{
    marginTop: '60px',
    animation: 'fadeIn 1s ease-in-out'
  }}>
    <ChatInterface />
  </div>
)}

    </div>
  );
}

export default ScrollWebtoon;
