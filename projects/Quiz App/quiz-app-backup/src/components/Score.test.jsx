// Score.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Score from '../components/Score';

describe('Score Component', () => {

    test('renders quiz completed heading', () => {
        render(<Score score={3} total={5} />);
        expect(screen.getByText('Quiz Completed!')).toBeInTheDocument();
    });

    test('renders correct score out of total', () => {
        render(<Score score={3} total={5} />);
        const h2 = document.querySelector('h2');
        expect(h2.textContent.replace(/\s+/g, ' ').trim()).toBe('Your Score: 3 / 5');
    });

    test('shows perfect message when score equals total', () => {
        render(<Score score={5} total={5} />);
        expect(screen.getByText('Perfect score! 🎉')).toBeInTheDocument();
    });

    test('shows encouragement message when score is less than total', () => {
        render(<Score score={3} total={5} />);
        expect(screen.getByText('Good try! Keep learning! 💪')).toBeInTheDocument();
    });

    test('renders score 0 correctly', () => {
        render(<Score score={0} total={5} />);
        const h2 = document.querySelector('h2');
        expect(h2.textContent.replace(/\s+/g, ' ').trim()).toBe('Your Score: 0 / 5');
        expect(screen.getByText('Better luck next time! 📚')).toBeInTheDocument();
    });
});