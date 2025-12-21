import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { questions } from '../data/questions';
import { getQuestionDetails } from '../data/questionDetails';
import { calculateScore, getTierInfo } from '../utils/scoreCalculator';
import './Result.css';

interface ResultProps {
    answers?: boolean[];
    sharedScore?: number;  // Score from URL for shared results
    onRestart: () => void;
}

export const Result = ({ answers, sharedScore, onRestart }: ResultProps) => {
    const { t, i18n } = useTranslation();

    const questionDetails = useMemo(() => getQuestionDetails(t), [i18n.language, t]);

    const score = useMemo(() => {
        if (sharedScore !== undefined) return sharedScore;
        if (!answers) return 50;
        return calculateScore(answers).score;
    }, [answers, sharedScore]);

    const isSharedResult = sharedScore !== undefined;

    // Format score logic
    let displayScore = score.toLocaleString(i18n.language, { maximumSignificantDigits: 4 });

    // Handle extremely small numbers
    if (score < 0.000001) {
        displayScore = score.toExponential(3);
    } else if (score < 0.0001) {
        displayScore = "< 0.0001";
    }

    const tierInfo = useMemo(() => getTierInfo(score), [score]);
    const tier = t(tierInfo.key);
    const tierColor = tierInfo.color;

    const oneInPeople = useMemo(() => {
        if (!Number.isFinite(score) || score <= 0) return null;
        return Math.max(1, Math.round(100 / score));
    }, [score]);

    // World population constant (2024 estimate)
    const WORLD_POPULATION = 8_000_000_000;

    // Calculate absolute number of people in this top percentile group
    const peopleInGroup = useMemo(() => {
        if (!Number.isFinite(score) || score <= 0) return null;
        return Math.round(WORLD_POPULATION * (score / 100));
    }, [score]);

    const [showCopied, setShowCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const handleShare = async () => {
        // Build share URL with score parameter
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?app=world-rank&score=${score}`;

        const shareData = {
            title: t('Awesome Rank'),
            text: t('I am in the Top {{score}}% of the global population! #AwesomeRank', { score: displayScore }),
            url: shareUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy', err);
            }
        }
    };

    return (
        <motion.div
            className="result-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
        >
            <div className="result-content-wrapper">
                <motion.div
                    className="tier-badge"
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    style={{
                        color: tierColor,
                        borderColor: tierColor,
                        boxShadow: `0 0 30px ${tierColor}40`
                    }}
                >
                    {tier}
                </motion.div>

                <motion.div
                    className="text-group"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <h2>{t('You are in the top')}</h2>
                </motion.div>

                <motion.div
                    className="score-display"
                    initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    transition={{ delay: 1.0, duration: 0.8, type: "spring" }}
                >
                    {displayScore}%
                </motion.div>

                <motion.p
                    className="context"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                >
                    {t('of the global population.')}
                </motion.p>

                <motion.div
                    className="divider"
                    initial={{ width: 0 }}
                    animate={{ width: "100px" }}
                    transition={{ delay: 1.8, duration: 0.5 }}
                />

                <motion.div
                    className="stat-detail"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.0 }}
                >
                    {oneInPeople !== null && peopleInGroup !== null && (
                        <p style={{ fontSize: '1.1rem', fontWeight: '700', color: tierColor, margin: '0.5rem 0' }}>
                            {t('That means you are 1 in')}{' '}
                            <span className="mono">{oneInPeople.toLocaleString(i18n.language)}</span>{' '}
                            {t('people.')}{' '}
                            {t('Out of 8 billion people, only')} <span className="mono">{peopleInGroup.toLocaleString(i18n.language)}</span> {t('are in this group.')}
                        </p>
                    )}
                    <p className="result-disclaimer">
                        {t('This result is a modeled estimate, not a factual measurement. Real-world rankings can differ, but the pattern can still be meaningful, especially when comparing across questions.')}
                    </p>
                </motion.div>
            </div>

            <motion.div
                className="action-buttons"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 2.5 }}
            >
                {!isSharedResult && (
                    <motion.button
                        className="btn-share"
                        onClick={handleShare}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {showCopied ? t('Copied!') : t('Share Result')}
                    </motion.button>
                )}

                {!isSharedResult && answers && (
                    <motion.button
                        className="btn-details"
                        onClick={() => setShowDetails(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {t('View Details')}
                    </motion.button>
                )}

                <motion.button
                    className="btn-restart"
                    onClick={onRestart}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {isSharedResult ? t('Try It Yourself') : t('Start Again')}
                </motion.button>
            </motion.div>

            <AnimatePresence>
                {showDetails && answers && (
                    <motion.div
                        className="details-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowDetails(false)}
                    >
                        <motion.div
                            className="details-modal"
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="details-header">
                                <h2>{t('Your Answers')}</h2>
                                <button
                                    className="details-close"
                                    onClick={() => setShowDetails(false)}
                                    aria-label={t('Close')}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="details-content">
                                {questions.map((q, index) => {
                                    const detail = questionDetails.find(d => d.question === t(q.id));
                                    const userAnswer = answers[index];
                                    return (
                                        <div key={q.id} className="detail-item">
                                            <div className="detail-question-header">
                                                <span className="detail-number">{`Q${index + 1}`}</span>
                                                <span className={`detail-answer ${userAnswer ? 'yes' : 'no'}`}>
                                                    {userAnswer ? t('YES') : t('NO')}
                                                </span>
                                            </div>
                                            <div className="detail-question-text">
                                                {t(q.id)}
                                            </div>
                                            <div className="detail-category">
                                                {t(q.category)}
                                            </div>
                                            {detail && (
                                                <div className="detail-stats">
                                                    <div className="detail-stat-row">
                                                        <span className="detail-stat-label">{t('Global Rate')}</span>
                                                        <span className="detail-stat-value">{detail.percentage}%</span>
                                                    </div>
                                                    <div className="detail-stat-row">
                                                        <span className="detail-stat-label">{t('Source')}</span>
                                                        <span className="detail-stat-value">{detail.source}</span>
                                                    </div>
                                                    <div className="detail-description">
                                                        {detail.details}
                                                    </div>
                                                    <div className="detail-implication">
                                                        <strong>{t('Implication')}:</strong> {detail.implication}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
