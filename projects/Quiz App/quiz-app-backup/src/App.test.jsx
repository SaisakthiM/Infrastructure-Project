// App.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import App from './App';
vi.mock('*.css', () => ({}));
vi.mock('**/*.css', () => ({}));

// Mock alert since jsdom doesn't support it
global.alert = vi.fn();

describe('App Component', () => {

    test('shows header before quiz starts', () => {
        render(<App />);
        expect(screen.getByText('Ready for the journey?')).toBeInTheDocument();
    });

    test('clicking start shows first question', () => {
        render(<App />);
        fireEvent.click(screen.getByText('Start'));
        expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    });

    test('clicking next without selecting shows alert', () => {
        render(<App />);
        fireEvent.click(screen.getByText('Start'));
        fireEvent.click(screen.getByText('Next'));
        expect(global.alert).toHaveBeenCalledWith('Please choose an option!');
    });

    test('correct answer increments score', () => {
        render(<App />);
        fireEvent.click(screen.getByText('Start'));

        // Answer all 5 questions correctly
        const correctAnswers = ['4', 'JavaScript', 'Markup Language', 'Library', 'Cascading Style Sheets'];
        correctAnswers.forEach(answer => {
            fireEvent.click(screen.getByText(answer));
            fireEvent.click(screen.getByText('Next'));
        });

        expect(screen.getByText(/5 \/ 5/i)).toBeInTheDocument();
    });

    test('shows score page after all questions answered', async () => {
        render(<App />);
        fireEvent.click(screen.getByText('Start'));

        for (let i = 0; i < 5; i++) {
            const options = screen.getAllByRole('listitem');
            fireEvent.click(options[0]);          // select any option
            fireEvent.click(screen.getByText('Next'));
        }

        expect(screen.getByText('Quiz Completed!')).toBeInTheDocument();
    });

    test('wrong answers result in score 0', () => {
        render(<App />);
        fireEvent.click(screen.getByText('Start'));

        // Go through all 5 questions picking the LAST option (wrong for all)
        const wrongAnswers = ['1', 'Java', 'Programming Language', 'Framework', 'Computer Style Sheets'];
        wrongAnswers.forEach(answer => {
            fireEvent.click(screen.getByText(answer));
            fireEvent.click(screen.getByText('Next'));
        });

        // Use textContent match since score is split across elements
        const h2 = document.querySelector('h2');
        expect(h2.textContent.replace(/\s+/g, ' ').trim()).toBe('Your Score: 0 / 5');
    });
});