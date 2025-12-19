import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { questions } from '../data/questions';
import './Quiz.css';

interface QuizProps {
    onFinish: (answers: boolean[]) => void;
}

export const Quiz = ({ onFinish }: QuizProps) => {
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<boolean[]>([]);

    const handleAnswer = (answer: boolean) => {
        // Add answer to local state
        const newAnswers = [...answers, answer];
        setAnswers(newAnswers);

        // Move to next question or finish
        if (index < questions.length - 1) {
            setTimeout(() => {
                setIndex(index + 1);
            }, 200); // Small delay for visual feedback
        } else {
            onFinish(newAnswers);
        }
    };

    const question = questions[index];
    const progress = ((index + 1) / questions.length) * 100;

    return (
        <div className="quiz-container">
            <div className="progress-container">
                <div className="progress-bar">
                    <motion.div
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
                <div className="progress-text">
                    {index + 1} / {questions.length}
                </div>
            </div>

            <div className="quiz-content">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={question.id}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="question-card glass-panel"
                    >
                        <div className="category-badge">{question.category.split('(')[0]}</div>
                        <h2 className="question-text">{question.text}</h2>

                        <div className="options-grid">
                            <motion.button
                                className="btn-option yes"
                                onClick={() => handleAnswer(true)}
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(0, 240, 255, 0.2)" }}
                                whileTap={{ scale: 0.98 }}
                            >
                                YES
                                <span className="key-hint">예</span>
                            </motion.button>

                            <motion.button
                                className="btn-option no"
                                onClick={() => handleAnswer(false)}
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 50, 50, 0.2)" }}
                                whileTap={{ scale: 0.98 }}
                            >
                                NO
                                <span className="key-hint">아니오</span>
                            </motion.button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
