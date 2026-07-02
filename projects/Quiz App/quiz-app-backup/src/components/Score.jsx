export default function Score({ score, total }) {
  const percentage = Math.round((score / total) * 100);
  const message =
    percentage === 100 ? "Perfect score! 🎉" :
    percentage >= 60  ? "Good try! Keep learning! 💪" :
                        "Better luck next time! 📚";

  return (
    <div className="container">
      <h1>Quiz Completed!</h1>
      <hr />
      <h2>Your Score: {score} / {total}</h2>
      <p>{message}</p>
    </div>
  );
}