import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { questions } from '../data/questions';
import './Result.css';

interface ResultProps {
    answers?: boolean[];
    sharedScore?: number;  // Score from URL for shared results
    onRestart: () => void;
}

const getLevelNumber = (category: string) => {
    const match = category.match(/Level\s*(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : 1;
};

const getLevelExponent = (level: number) => {
    // More foundational levels should matter more (Level 1 -> 5, Level 5 -> 1).
    return Math.min(5, Math.max(1, 6 - level));
};

const JEFFREYS_PRIOR_ALPHA = 0.5;
const JEFFREYS_PRIOR_BETA = 0.5;

const levelRate = (yesCount: number, totalCount: number) =>
    (yesCount + JEFFREYS_PRIOR_ALPHA) / (totalCount + JEFFREYS_PRIOR_ALPHA + JEFFREYS_PRIOR_BETA);

const computeYesCountDistribution = (questionIndices: number[]) => {
    let dp = new Array<number>(questionIndices.length + 1).fill(0);
    dp[0] = 1;

    for (const questionIndex of questionIndices) {
        const pYes = questions[questionIndex].probability;
        const next = new Array<number>(dp.length).fill(0);
        for (let yesCount = 0; yesCount < dp.length; yesCount += 1) {
            const p = dp[yesCount];
            if (p === 0) continue;

            next[yesCount] += p * (1 - pYes);
            if (yesCount + 1 < dp.length) next[yesCount + 1] += p * pYes;
        }
        dp = next;
    }

    return dp;
};

const levelModel = (() => {
    const byLevel = new Map<number, number[]>();
    for (let idx = 0; idx < questions.length; idx += 1) {
        const level = getLevelNumber(questions[idx].category);
        const existing = byLevel.get(level);
        if (existing) existing.push(idx);
        else byLevel.set(level, [idx]);
    }

    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    const data = levels.map((level) => {
        const indices = byLevel.get(level) ?? [];
        return {
            level,
            exponent: getLevelExponent(level),
            indices,
            count: indices.length,
            yesCountDistribution: computeYesCountDistribution(indices)
        };
    });

    const exponentSum = data.reduce((sum, l) => sum + l.exponent, 0);

    const compositeIndexFromYesCounts = (yesCounts: number[]) => {
        let weightedLogSum = 0;
        for (let i = 0; i < data.length; i += 1) {
            const rate = levelRate(yesCounts[i] ?? 0, data[i].count);
            weightedLogSum += data[i].exponent * Math.log(rate);
        }
        return Math.exp(weightedLogSum / exponentSum);
    };

    return { data, exponentSum, compositeIndexFromYesCounts };
})();

const lowerBoundByScore = (sortedScores: Array<{ score: number }>, target: number) => {
    let lo = 0;
    let hi = sortedScores.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sortedScores[mid].score < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
};

// Precompute the global score table under an (admittedly naive) independence assumption.
// This gives a grounded "Top X%" number: P(globalCompositeIndex >= yourCompositeIndex) * 100.
const globalScoreTable = (() => {
    const entries: Array<{ score: number; probability: number }> = [];
    const yesCounts = new Array<number>(levelModel.data.length).fill(0);

    const walk = (levelIndex: number, probability: number) => {
        if (levelIndex >= levelModel.data.length) {
            entries.push({ score: levelModel.compositeIndexFromYesCounts(yesCounts), probability });
            return;
        }

        const dp = levelModel.data[levelIndex].yesCountDistribution;
        for (let k = 0; k < dp.length; k += 1) {
            const p = dp[k];
            if (p === 0) continue;
            yesCounts[levelIndex] = k;
            walk(levelIndex + 1, probability * p);
        }
    };

    walk(0, 1);

    entries.sort((a, b) => a.score - b.score);

    const tailProbability = new Array<number>(entries.length);
    let acc = 0;
    for (let i = entries.length - 1; i >= 0; i -= 1) {
        acc += entries[i].probability;
        tailProbability[i] = acc;
    }

    return { entries, tailProbability };
})();

export const Result = ({ answers, sharedScore, onRestart }: ResultProps) => {
    const { t } = useTranslation();

    // Calculate score from answers or use shared score
    const score = (() => {
        if (sharedScore !== undefined) {
            return sharedScore;
        }
        if (!answers) {
            return 50; // Default fallback
        }
        // Calculate a level-wise (non-compensatory) composite index, then convert it to a global "Top X%" percentile.
        const userLevelYesCounts = levelModel.data.map((level) =>
            level.indices.reduce((count, questionIndex) => count + (answers[questionIndex] ? 1 : 0), 0)
        );
        const userCompositeIndex = levelModel.compositeIndexFromYesCounts(userLevelYesCounts);

        const startIndex = lowerBoundByScore(globalScoreTable.entries, userCompositeIndex);
        const topShareRaw = startIndex < globalScoreTable.tailProbability.length
            ? globalScoreTable.tailProbability[startIndex]
            : 0;
        const topShare = Math.min(1, Math.max(0, topShareRaw));
        return topShare * 100;
    })();

    const isSharedResult = sharedScore !== undefined;

    // Format score logic
    let displayScore = score.toLocaleString(undefined, { maximumSignificantDigits: 4 });

    // Handle extremely small numbers
    if (score < 0.000001) {
        displayScore = score.toExponential(3);
    } else if (score < 0.0001) {
        displayScore = "< 0.0001";
    }

    // Calculate how many people share this level globally (out of 8 billion)
    const WORLD_POPULATION = 8_000_000_000;
    const topShare = score / 100;
    const peopleAtThisLevel = Math.round(WORLD_POPULATION * topShare);
    const peopleString = peopleAtThisLevel.toLocaleString();

    // Determine Tier
    let tier = t("Global Citizen");
    let tierColor = "#a0a0a0"; // Gray

    if (score < 0.000001) { tier = t("Singularity Class"); tierColor = "#ff00ff"; } // Magenta
    else if (score < 0.0001) { tier = t("Visionary Elite"); tierColor = "#ff0055"; } // Red/Pink
    else if (score < 0.01) { tier = t("World Class"); tierColor = "#ffd700"; } // Gold
    else if (score < 1) { tier = t("Top 1% Elite"); tierColor = "#00f3ff"; } // Cyan
    else if (score < 10) { tier = t("High Achiever"); tierColor = "#00f3ff"; } // Cyan
    else if (score < 30) { tier = t("Global Middle Class"); tierColor = "#4cd137"; } // Green
    else if (score < 60) { tier = t("Aspiring Global"); tierColor = "#fbc531"; } // Yellow

    const [showCopied, setShowCopied] = useState(false);

    const handleShare = async () => {
        // Build share URL with score parameter
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?app=world-rank&score=${score}`;

        const shareData = {
            title: 'Awesome Rank',
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
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tierColor, margin: '0.5rem 0' }}>{peopleString}</p>
                    <p>{t('people')}</p>
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

                <motion.button
                    className="btn-restart"
                    onClick={onRestart}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {isSharedResult ? t('Try It Yourself') : t('Start Again')}
                </motion.button>
            </motion.div>
        </motion.div>
    );
};
