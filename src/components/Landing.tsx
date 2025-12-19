import { motion } from 'framer-motion';
import './Landing.css';

interface LandingProps {
    onStart: () => void;
}

export const Landing = ({ onStart }: LandingProps) => {
    return (
        <motion.div
            className="landing-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <motion.div
                className="title-wrapper"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
            >
                <h1 className="main-title">WORLD<br />RANK</h1>
                <div className="year-badge">2025</div>
            </motion.div>

            <motion.p
                className="subtitle"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
            >
                Where do you stand among<br />8 billion people?
            </motion.p>

            <motion.button
                className="btn-primary"
                onClick={onStart}
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px var(--primary-glow-strong)" }}
                whileTap={{ scale: 0.95 }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: "spring" }}
            >
                Begin Analysis
            </motion.button>

            <div className="decor-circle"></div>
        </motion.div>
    );
};
