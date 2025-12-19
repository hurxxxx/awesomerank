import { motion } from 'framer-motion';
import { questions } from '../data/questions';
import './Result.css';

interface ResultProps {
    answers: boolean[];
    onRestart: () => void;
}

export const Result = ({ answers, onRestart }: ResultProps) => {
    // Calculate score: Product of probabilities of YES answers * 100
    const probability = answers.reduce((acc, ans, idx) => {
        if (ans) {
            return acc * questions[idx].probability;
        }
        return acc;
    }, 1.0);

    const score = probability * 100;

    // Format score logic
    let displayScore = score.toLocaleString(undefined, { maximumSignificantDigits: 4 });

    // Handle extremely small numbers
    if (score < 0.000001) {
        displayScore = score.toExponential(3);
    } else if (score < 0.0001) {
        displayScore = "< 0.0001";
    }

    // Calculate "1 in X people"
    const oneInX = Math.round(1 / probability);
    const oneInXString = oneInX.toLocaleString();

    // Determine Tier
    let tier = "Global Citizen";
    let tierColor = "#a0a0a0"; // Gray

    if (score < 0.000001) { tier = "Singularity Class"; tierColor = "#ff00ff"; } // Magenta
    else if (score < 0.0001) { tier = "Visionary Elite"; tierColor = "#ff0055"; } // Red/Pink
    else if (score < 0.01) { tier = "World Class"; tierColor = "#ffd700"; } // Gold
    else if (score < 1) { tier = "Top 1% Elite"; tierColor = "#00f3ff"; } // Cyan
    else if (score < 10) { tier = "High Achiever"; tierColor = "#00f3ff"; } // Cyan
    else if (score < 30) { tier = "Global Middle Class"; tierColor = "#4cd137"; } // Green
    else if (score < 60) { tier = "Aspiring Global"; tierColor = "#fbc531"; } // Yellow

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
                    <h2>You are in the top</h2>
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
                    of the global population.
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
                    <p>That means you are 1 in</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tierColor, margin: '0.5rem 0' }}>{oneInXString}</p>
                    <p>people.</p>
                </motion.div>
            </div>

            <motion.button
                className="btn-restart"
                onClick={onRestart}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 2.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                Start Again
            </motion.button>
        </motion.div>
    );
};
