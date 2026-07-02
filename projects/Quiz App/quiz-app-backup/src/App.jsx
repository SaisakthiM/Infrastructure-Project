import React, { useState } from "react";
import Header from "./components/Header";
import Quiz from "./components/Quiz";
import Score from "./components/Score";
import "./index.css"

export default function App() {
	const questions = [
		{ question: "What is 2 + 2?", options: ["1","2","3","4"], answer: 3 },
		{ question: "JS stands for?", options: ["Java","JavaScript","JQuery","JSON"], answer: 1 },
		{ question: "HTML is a?", options: ["Programming Language","Markup Language","Database","CSS"], answer: 1 },
		{ question: "React is a?", options: ["Library","Framework","Database","Language"], answer: 0 },
		{ question: "CSS stands for?", options: ["Cascading Style Sheets","Computer Style Sheets","Creative Style Sheets","Color Style Sheets"], answer: 0 },
	];

	const [quizStarted, setQuizStarted] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [score, setScore] = useState(0);

	const handleAnswer = (correct) => {
		if(correct) setScore(prev => prev + 1);
	};

	const handleNext = (selected) => {
		if(selected === null) {
		alert("Please choose an option!");
		} else {
		setCurrentIndex(prev => prev + 1);
		}
	};

	// Conditional rendering
	if(!quizStarted) {
		return <Header onStart={() => setQuizStarted(true)} />;
	}

	if(currentIndex >= questions.length) {
		return <Score score={score} total={questions.length} />;
	}

	const current = questions[currentIndex];

	return (
		<Quiz 
		key={currentIndex} 
		Questions={current.question} 
		Options={current.options} 
		Answer={current.answer}
		onAnswer={handleAnswer} 
		onNext={handleNext}
		/>
	);
}








































