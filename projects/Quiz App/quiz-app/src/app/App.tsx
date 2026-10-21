import { useState } from "react";

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

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; bars: number; color: string }> = {
  easy: { label: "Easy", bars: 1, color: "var(--ok)" },
  medium: { label: "Medium", bars: 2, color: "var(--warn)" },
  hard: { label: "Hard", bars: 3, color: "var(--bad)" },
};


type Screen = "welcome" | "quiz" | "result";

function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  const c = DIFFICULTY_CONFIG[difficulty];
  return (
    <span className="pill" style={{ color: c.color, borderColor: c.color }}>
      {"▮".repeat(c.bars)}
      {"▯".repeat(3 - c.bars)} {c.label}
    </span>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="glass accent qa-card">
      <div className="bd">
        <div className="eyebrow">Quiz Arena · district</div>
        <h1 className="display qa-title">CS Quiz</h1>
        <p className="qa-sub">{questions.length} handpicked computer-science questions. Instant feedback, difficulty-weighted tracking.</p>
        <div className="qa-diff">
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <div key={d} className="glass">
              <b style={{ color: DIFFICULTY_CONFIG[d].color }}>{questions.filter((q) => q.difficulty === d).length}</b>
              <small>{DIFFICULTY_CONFIG[d].label}</small>
            </div>
          ))}
        </div>
        <button className="btn primary block" onClick={onStart}>Start quiz →</button>
      </div>
    </div>
  );
}

function Question({
  question, index, score, onAnswer, onNext,
}: {
  question: Question; index: number; score: number; onAnswer: (correct: boolean) => void; onNext: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const pick = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    onAnswer(i === question.answer);
  };
  const progress = (index / questions.length) * 100;
  return (
    <div className="glass accent qa-card">
      <div className="bd">
        <div className="qa-top">
          <span>Q{index + 1}/{questions.length}</span>
          <div className="qa-bar"><i style={{ width: `${progress}%` }} /></div>
          <span>★ {score}</span>
        </div>
        <div className="qa-meta">
          <span className="eyebrow">{question.topic}</span>
          <DifficultyTag difficulty={question.difficulty} />
        </div>
        <h2 className="qa-q">{question.question}</h2>
        <div className="qa-opts">
          {question.options.map((opt, i) => {
            const revealed = selected !== null;
            const cls = revealed && i === question.answer ? " good" : revealed && i === selected ? " bad" : "";
            return (
              <button key={i} className={"qa-opt" + cls} disabled={revealed} onClick={() => pick(i)}>
                <span className="k">{String.fromCharCode(65 + i)}</span>
                <span className="t">{opt}</span>
                {revealed && i === question.answer && <span className="ok">✓</span>}
                {revealed && i === selected && i !== question.answer && <span className="bad">✕</span>}
              </button>
            );
          })}
        </div>
        <button className="btn primary block" style={{ marginTop: 18 }} disabled={selected === null} onClick={onNext}>
          {index === questions.length - 1 ? "See results" : "Next question"} →
        </button>
      </div>
    </div>
  );
}

function Results({ score, onRestart }: { score: number; onRestart: () => void }) {
  const total = questions.length;
  const pct = Math.round((score / total) * 100);
  const verdict =
    pct === 100 ? { t: "Flawless", s: "You aced every question.", c: "var(--ok)" } :
    pct >= 80 ? { t: "Outstanding", s: "Top-tier CS knowledge.", c: "var(--accent)" } :
    pct >= 60 ? { t: "Good work", s: "Solid foundation. Keep building.", c: "var(--accent)" } :
    pct >= 40 ? { t: "Keep studying", s: "Review and retry.", c: "var(--warn)" } :
                { t: "Keep going", s: "Every expert was once a beginner.", c: "var(--bad)" };
  const C = 2 * Math.PI * 62;
  return (
    <div className="glass accent qa-card">
      <div className="bd" style={{ textAlign: "center" }}>
        <div className="qa-ring">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="62" fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx="75" cy="75" r="62" fill="none" stroke={verdict.c} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} style={{ transition: "stroke-dashoffset 1s ease" }} />
          </svg>
          <div className="n" style={{ color: verdict.c }}><span>{pct}%<small>{score}/{total}</small></span></div>
        </div>
        <h2 className="display" style={{ margin: "0 0 4px", color: verdict.c }}>{verdict.t}</h2>
        <p className="qa-sub">{verdict.s}</p>
        <div className="qa-rows" style={{ textAlign: "left", marginBottom: 18 }}>
          <div><span className="muted">Questions</span><b>{total}</b></div>
          <div><span className="muted">Correct</span><b className="ok">{score}</b></div>
          <div><span className="muted">Wrong</span><b className="bad">{total - score}</b></div>
        </div>
        <button className="btn primary block" onClick={onRestart}>↺ Try again</button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);

  const start = () => {
    setIndex(0);
    setScore(0);
    setScreen("quiz");
  };

  return (
    <main className="qa-wrap">
      {screen === "welcome" && <Welcome onStart={start} />}
      {screen === "quiz" && (
        <Question
          key={index}
          question={questions[index]}
          index={index}
          score={score}
          onAnswer={(ok) => ok && setScore((n) => n + 1)}
          onNext={() => (index < questions.length - 1 ? setIndex((i) => i + 1) : setScreen("result"))}
        />
      )}
      {screen === "result" && <Results score={score} onRestart={start} />}
    </main>
  );
}
