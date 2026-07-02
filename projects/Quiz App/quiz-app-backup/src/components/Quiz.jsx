import { useState } from "react";

export default function Quiz({ Questions, Options, Answer, onAnswer, onNext }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (index) => {
    if (selected === null) {
      setSelected(index);
      onAnswer(index === Answer);
    }
  };

  return (
    <div className="container">
      <h1>Quiz App</h1>
      <hr />
      <h2>{Questions}</h2>
      <ul>
        {Options.map((option, index) => (
          <li
            key={index}
            onClick={() => handleSelect(index)}
            className={
              selected === null
                ? "option"
                : index === selected && index === Answer
                ? "option correct"
                : index === selected
                ? "option wrong"
                : index === Answer && selected !== null
                ? "option correct"
                : "option"
            }
          >
            {option}
          </li>
        ))}
      </ul>
      <div className="button_quiz">
        <button onClick={() => onNext(selected)}>Next</button>
      </div>
    </div>
  );
}