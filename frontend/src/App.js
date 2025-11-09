import { useEffect, useState } from 'react';
import './App.css';
import WebtoonViewer from './components/webtoon/WebtoonViewer';
import heroTitle from './assets/images/hero-title.png';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isLoading]);

  // 스크롤 함수
  const scrollToWebtoon = () => {
    const webtoonSection = document.querySelector('main');
    if (webtoonSection) {
      webtoonSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start' 
      });
    }
  };

  return (
    <div className={`App${isLoading ? ' is-loading' : ''}`}>
      {isLoading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <img
            src={heroTitle}
            alt="대구-대구 타이틀"
            className="loading-hero"
          />
          <div className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">대구-대구로 입장하고 있어요...</p>
          <p className="loading-subtext">잠시만 기다려주세요!</p>
        </div>
      )}
      <div className="App-content" aria-hidden={isLoading}>
        <header className="App-header">
          {/* 중앙 부양 타이틀 이미지 */}
          <img
            src={heroTitle}
            alt="타이틀"
            className="hero-title"
          />
          
          {/* 클릭 가능한 스크롤 유도 섹션 (타이틀 아래로 더 내림) */}
          <div 
            className="scroll-indicator"
            onClick={scrollToWebtoon}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                scrollToWebtoon();
              }
            }}
          >
            <p>아래로 스크롤해서 대구-대구와 만나보세요!</p>
            <div className="scroll-arrow">↓</div>
            <p style={{ 
              fontSize: '12px', 
              opacity: '0.7', 
              marginTop: '10px' 
            }}>
              클릭해보세요!
            </p>
          </div>
        </header>
        
        <main>
          <WebtoonViewer />
        </main>
      </div>
    </div>
  );
}

export default App;
