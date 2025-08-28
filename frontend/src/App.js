import './App.css';
import WebtoonViewer from './components/webtoon/WebtoonViewer';

function App() {
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
    <div className="App">
      <header className="App-header">
        <h1>🎭 DAEGU! 같이 가도 대구</h1>
        <p>AI 기반 인터랙티브 웹툰</p>
        
        {/* 클릭 가능한 스크롤 유도 섹션 */}
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
  );
}

export default App;