// Header.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Header from '../components/Header';
vi.mock('*.css', () => ({}));
vi.mock('**/*.css', () => ({}));

describe('Header Component', () => {

    test('renders quiz app title', () => {
        render(<Header onStart={vi.fn()} />);
        expect(screen.getByText('Quiz App')).toBeInTheDocument();
    });

    test('renders description text', () => {
        render(<Header onStart={vi.fn()} />);
        expect(screen.getByText(/5 questions/i)).toBeInTheDocument();
    });

    test('renders start button', () => {
        render(<Header onStart={vi.fn()} />);
        expect(screen.getByText('Start')).toBeInTheDocument();
    });

    test('clicking start calls onStart', () => {
        const mockStart = vi.fn();
        render(<Header onStart={mockStart} />);
        fireEvent.click(screen.getByText('Start'));
        expect(mockStart).toHaveBeenCalledTimes(1);
    });
});