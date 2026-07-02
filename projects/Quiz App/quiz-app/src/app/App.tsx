import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, Trophy, Zap, Code2, Brain, ChevronRight, RotateCcw, Star } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";

interface Question {
  question: string;
  options: string[];
  answer: number;
  difficulty: Difficulty;
  topic: string;
}

const questions: Question[] = [
  {
    question: "What is the time complexity of binary search?",
    options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
    answer: 1,
    difficulty: "easy",
    topic: "Algorithms",
  },
  {
    question: "Which data structure uses LIFO (Last In, First Out) order?",
    options: ["Queue", "Linked List", "Stack", "Heap"],
    answer: 2,
    difficulty: "easy",
    topic: "Data Structures",
  },
  {
    question: "What does DNS stand for?",
    options: ["Data Network System", "Domain Name System", "Distributed Node Service", "Dynamic Name Server"],
    answer: 1,
    difficulty: "easy",
    topic: "Networking",
  },
  {
    question: "In object-oriented programming, what is encapsulation?",
    options: [
      "Inheriting properties from a parent class",
      "Binding data and methods that operate on that data",
      "Creating multiple forms of a method",
      "Hiding implementation via interfaces",
    ],
    answer: 1,
    difficulty: "medium",
    topic: "OOP",
  },
  {
    question: "What is the worst-case time complexity of QuickSort?",
    options: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"],
    answer: 2,
    difficulty: "medium",
    topic: "Algorithms",
  },
  {
    question: "Which SQL clause is used to filter groups after aggregation?",
    options: ["WHERE", "FILTER", "HAVING", "GROUP BY"],
    answer: 2,
    difficulty: "medium",
    topic: "Databases",
  },
  {
    question: "In the OSI model, which layer handles routing between networks?",
    options: ["Data Link Layer", "Transport Layer", "Network Layer", "Session Layer"],
    answer: 2,
    difficulty: "medium",
    topic: "Networking",
  },
  {
    question: "What is a race condition in concurrent programming?",
    options: [
      "When two threads run at exactly the same CPU speed",
      "When program output depends on non-deterministic timing of concurrent events",
      "When a thread locks a resource indefinitely",
      "When two processes compete for the same CPU core",
    ],
    answer: 1,
    difficulty: "hard",
    topic: "Systems",
  },
  {
    question: "Which of the following is NOT a property guaranteed by ACID transactions?",
    options: ["Atomicity", "Concurrency", "Isolation", "Durability"],
    answer: 1,
    difficulty: "hard",
    topic: "Databases",
  },
  {
    question: "In the CAP theorem, which two properties can a distributed system guarantee simultaneously?",
    options: [
      "Consistency and Availability only",
      "Availability and Partition tolerance only",
      "Any two of the three",
      "Only one at a time",
    ],
    answer: 2,
    difficulty: "hard",
    topic: "Distributed Systems",
  },
];

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; bars: number; color: string; bg: string }> = {
  easy: { label: "Easy", bars: 1, color: "#10b981", bg: "bg-emerald-500" },
  medium: { label: "Medium", bars: 2, color: "#f59e0b", bg: "bg-amber-500" },
  hard: { label: "Hard", bars: 3, color: "#ef4444", bg: "bg-red-500" },
};

type Screen = "welcome" | "quiz" | "result";

function DifficultyBar({ difficulty }: { difficulty: Difficulty }) {
  const config = DIFFICULTY_CONFIG[difficulty];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2 rounded-sm transition-all duration-300"
            style={{
              height: i === 1 ? "10px" : i === 2 ? "14px" : "18px",
              backgroundColor: i <= config.bars ? config.color : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
      <span className="font-mono text-xs font-medium" style={{ color: config.color }}>
        {config.label}
      </span>
    </div>
  );
}

function ScoreBar({ score, total, current }: { score: number; total: number; current: number }) {
  const pct = total > 0 ? (score / total) * 100 : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-400" />
        <span className="font-mono text-sm font-semibold text-foreground">
          {score}<span className="text-muted-foreground">/{total}</span>
        </span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden min-w-[80px]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #7c3aed, #06b6d4)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        Q{current}/{questions.length}
      </span>
    </div>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 py-12"
    >
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
          >
            <Code2 className="w-10 h-10 text-white" />
          </div>
        </div>

        <h1
          className="text-5xl font-extrabold text-center mb-3 tracking-tight"
          style={{ fontFamily: "'Outfit', sans-serif", background: "linear-gradient(135deg, #e8e8ff, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          CS Quiz
        </h1>
        <p className="text-center text-muted-foreground mb-10 text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Test your computer science knowledge across 10 handpicked questions
        </p>

        <div className="grid grid-cols-3 gap-3 mb-10">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
            const count = questions.filter((q) => q.difficulty === d).length;
            const config = DIFFICULTY_CONFIG[d];
            return (
              <div key={d} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-2xl font-bold mb-1" style={{ color: config.color, fontFamily: "'Outfit', sans-serif" }}>
                  {count}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{config.label}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 mb-10">
          {[
            { icon: Brain, text: "10 curated CS questions" },
            { icon: Zap, text: "Instant feedback on every answer" },
            { icon: Trophy, text: "Score tracking with difficulty weighting" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
                <Icon className="w-4 h-4" style={{ color: "#7c3aed" }} />
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif" }}>{text}</span>
            </div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="w-full py-4 rounded-xl font-bold text-lg text-white flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", fontFamily: "'Outfit', sans-serif" }}
        >
          Start Quiz <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function QuizScreen({
  question,
  index,
  score,
  answeredCount,
  onAnswer,
  onNext,
}: {
  question: Question;
  index: number;
  score: number;
  answeredCount: number;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    onAnswer(i === question.answer);
  };

  const progress = ((index) / questions.length) * 100;

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col min-h-screen px-6 py-6 max-w-xl mx-auto w-full"
    >
      {/* Top bar */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <ScoreBar score={score} total={answeredCount} current={index + 1} />
        <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #7c3aed, #06b6d4)", width: `${progress}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-mono text-xs px-3 py-1 rounded-full"
          style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
        >
          {question.topic}
        </span>
        <DifficultyBar difficulty={question.difficulty} />
      </div>

      {/* Question */}
      <div className="rounded-2xl p-6 mb-6 flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-xl font-semibold leading-snug" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 flex-1">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.answer;
          const isSelected = i === selected;
          const revealed = selected !== null;

          let borderColor = "rgba(255,255,255,0.1)";
          let bg = "rgba(255,255,255,0.04)";
          let textColor = "#e8e8ff";
          let icon = null;

          if (revealed && isCorrect) {
            borderColor = "#10b981";
            bg = "rgba(16,185,129,0.12)";
            textColor = "#6ee7b7";
            icon = <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#10b981" }} />;
          } else if (revealed && isSelected && !isCorrect) {
            borderColor = "#ef4444";
            bg = "rgba(239,68,68,0.12)";
            textColor = "#fca5a5";
            icon = <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />;
          }

          return (
            <motion.button
              key={i}
              whileHover={selected === null ? { scale: 1.01 } : {}}
              whileTap={selected === null ? { scale: 0.99 } : {}}
              onClick={() => handleSelect(i)}
              className="w-full rounded-xl p-4 text-left flex items-center gap-3 transition-all duration-200"
              style={{
                background: bg,
                border: `1px solid ${borderColor}`,
                color: textColor,
                cursor: selected !== null ? "default" : "pointer",
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              <span
                className="font-mono text-xs w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)", color: "#6666aa" }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 font-medium">{opt}</span>
              {icon}
            </motion.button>
          );
        })}
      </div>

      {/* Next */}
      <div className="mt-6">
        <motion.button
          whileHover={selected !== null ? { scale: 1.02 } : {}}
          whileTap={selected !== null ? { scale: 0.98 } : {}}
          onClick={onNext}
          disabled={selected === null}
          className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-200"
          style={{
            background: selected !== null ? "linear-gradient(135deg, #7c3aed, #06b6d4)" : "rgba(255,255,255,0.06)",
            color: selected !== null ? "#fff" : "#4444aa",
            cursor: selected !== null ? "pointer" : "not-allowed",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {index === questions.length - 1 ? "See Results" : "Next Question"}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function ResultScreen({ score, onRestart }: { score: number; onRestart: () => void }) {
  const total = questions.length;
  const pct = Math.round((score / total) * 100);

  const message =
    pct === 100 ? { text: "Flawless Victory!", sub: "You aced every question. Legendary.", color: "#10b981" } :
    pct >= 80  ? { text: "Outstanding!", sub: "Top-tier CS knowledge on display.", color: "#06b6d4" } :
    pct >= 60  ? { text: "Good Work!", sub: "Solid foundation. Keep building.", color: "#7c3aed" } :
    pct >= 40  ? { text: "Keep Studying!", sub: "You're on your way. Review and retry.", color: "#f59e0b" } :
                 { text: "Keep Going!", sub: "Every expert was once a beginner.", color: "#ef4444" };

  const circumference = 2 * Math.PI * 54;
  const dash = (pct / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 py-12"
    >
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
              <motion.circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                animate={{ strokeDashoffset: circumference - dash }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                transform="rotate(-90 64 64)"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-extrabold text-2xl" style={{ fontFamily: "'Outfit', sans-serif", color: message.color }}>
                {pct}%
              </span>
              <span className="font-mono text-xs text-muted-foreground">{score}/{total}</span>
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-center mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: message.color }}>
          {message.text}
        </h2>
        <p className="text-center text-muted-foreground mb-10" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {message.sub}
        </p>

        {/* Breakdown by difficulty */}
        <div className="rounded-2xl p-5 mb-8 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">Score Summary</p>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#e8e8ff" }}>Total Questions</span>
            <span className="font-mono text-sm font-semibold text-foreground">{total}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#e8e8ff" }}>Correct Answers</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "#10b981" }}>{score}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#e8e8ff" }}>Wrong Answers</span>
            <span className="font-mono text-sm font-semibold" style={{ color: "#ef4444" }}>{total - score}</span>
          </div>
          <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: "#e8e8ff" }}>Accuracy</span>
              <span className="font-mono text-sm font-bold" style={{ color: message.color }}>{pct}%</span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRestart}
          className="w-full py-4 rounded-xl font-bold text-lg text-white flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", fontFamily: "'Outfit', sans-serif" }}
        >
          <RotateCcw className="w-5 h-5" /> Play Again
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  const handleStart = () => {
    setCurrentIndex(0);
    setScore(0);
    setAnsweredCount(0);
    setScreen("quiz");
  };

  const handleAnswer = (correct: boolean) => {
    setAnsweredCount((n) => n + 1);
    if (correct) setScore((n) => n + 1);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setScreen("result");
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 20% 10%, rgba(124,58,237,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, rgba(6,182,212,0.1) 0%, transparent 50%), #0a0a1a",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        {screen === "welcome" && (
          <WelcomeScreen key="welcome" onStart={handleStart} />
        )}
        {screen === "quiz" && (
          <QuizScreen
            key={`quiz-${currentIndex}`}
            question={questions[currentIndex]}
            index={currentIndex}
            score={score}
            answeredCount={answeredCount}
            onAnswer={handleAnswer}
            onNext={handleNext}
          />
        )}
        {screen === "result" && (
          <ResultScreen key="result" score={score} onRestart={handleStart} />
        )}
      </AnimatePresence>
    </div>
  );
}
