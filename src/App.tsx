import { useState } from 'react';
import { Landing } from './components/Landing';
import { Quiz } from './components/Quiz';
import { Result } from './components/Result';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [view, setView] = useState<'landing' | 'quiz' | 'result'>('landing');
  const [answers, setAnswers] = useState<boolean[]>([]);

  const startQuiz = () => setView('quiz');
  const finishQuiz = (finalAnswers: boolean[]) => {
    setAnswers(finalAnswers);
    setView('result');
  };
  const restart = () => {
    setAnswers([]);
    setView('landing');
  };

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' && <Landing onStart={startQuiz} key="landing" />}
      {view === 'quiz' && <Quiz onFinish={finishQuiz} key="quiz" />}
      {view === 'result' && <Result answers={answers} onRestart={restart} key="result" />}
    </AnimatePresence>
  );
}

export default App;
