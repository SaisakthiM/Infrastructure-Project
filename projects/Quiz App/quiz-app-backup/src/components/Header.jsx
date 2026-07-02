export default function Header({ onStart }) {
  return (
    <div className="container">
      <h1>Quiz App</h1>
      <hr />
      <h3>This is a Quiz Game. You will be asked 5 questions about general CS topics.</h3>
      <h2>Ready for the journey?</h2>
      <div className="button_quiz">
        <button onClick={onStart}>Start</button>
      </div>
    </div>
  );
}