// Quiz.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Quiz from '../components/Quiz';
vi.mock('*.css', () => ({}));
vi.mock('**/*.css', () => ({}));

const mockProps = {
    Questions: "What is 2 + 2?",
    Options: ["1", "2", "3", "4"],
    Answer: 3,
    onAnswer: vi.fn(),
    onNext: vi.fn(),
};

describe('Quiz Component', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders the question', () => {
        render(<Quiz {...mockProps} />);
        expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    test('renders all options', () => {
        render(<Quiz {...mockProps} />);
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
    });

    test('renders next button', () => {
        render(<Quiz {...mockProps} />);
        expect(screen.getByText('Next')).toBeInTheDocument();
    });

    test('clicking correct answer calls onAnswer with true', () => {
        render(<Quiz {...mockProps} />);
        fireEvent.click(screen.getByText('4')); // index 3 = Answer
        expect(mockProps.onAnswer).toHaveBeenCalledWith(true);
    });

    test('clicking wrong answer calls onAnswer with false', () => {
        render(<Quiz {...mockProps} />);
        fireEvent.click(screen.getByText('1')); // index 0 ≠ Answer
        expect(mockProps.onAnswer).toHaveBeenCalledWith(false);
    });

    test('selecting an option applies a highlight class', () => {
        render(<Quiz {...mockProps} />);
        const option = screen.getByText('1'); // wrong answer
        fireEvent.click(option);
        // Should have some class applied after clicking
        expect(option.className).not.toBe('');
    });

    test('cannot select another option after selecting one', () => {
        render(<Quiz {...mockProps} />);
        fireEvent.click(screen.getByText('1')); // first selection
        fireEvent.click(screen.getByText('4')); // try to change
        expect(mockProps.onAnswer).toHaveBeenCalledTimes(1); // only called once
    });

    test('clicking next calls onNext with selected index', () => {
        render(<Quiz {...mockProps} />);
        fireEvent.click(screen.getByText('4')); // select index 3
        fireEvent.click(screen.getByText('Next'));
        expect(mockProps.onNext).toHaveBeenCalledWith(3);
    });

    test('clicking next without selection calls onNext with null', () => {
        render(<Quiz {...mockProps} />);
        fireEvent.click(screen.getByText('Next'));
        expect(mockProps.onNext).toHaveBeenCalledWith(null);
    });
});