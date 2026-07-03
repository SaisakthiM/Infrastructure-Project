// LoginPage.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

const mockLogin = vi.fn().mockRejectedValue({
    response: { data: { detail: 'Invalid credentials.' } }
});
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ login: vi.fn() })
}));



vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
        p:   ({ children, ...props }) => <p   {...props}>{children}</p>,
    },
}));
vi.mock('../../components/common/Loaders', () => ({
    Spinner: () => <span>Loading...</span>,
}));

describe('LoginPage', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders login form', () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        expect(screen.getByPlaceholderText('your_username')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    test('renders nexus branding', () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        expect(screen.getByText('nexus')).toBeInTheDocument();
    });

    test('renders sign up link', () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        expect(screen.getByText('Sign up')).toBeInTheDocument();
    });

    test('shows error when fields are empty', async () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: /log in/i }));
        await waitFor(() => {
            expect(screen.getByText('Please fill in all fields')).toBeInTheDocument();
        });
    });

    test('typing updates username and password', () => {
        render(<MemoryRouter><LoginPage /></MemoryRouter>);
        fireEvent.change(screen.getByPlaceholderText('your_username'), {
            target: { value: 'john_doe' }
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'TestPass123!' }
        });
        expect(screen.getByPlaceholderText('your_username')).toHaveValue('john_doe');
        expect(screen.getByPlaceholderText('••••••••')).toHaveValue('TestPass123!');
    });

    test('successful login navigates to home', async () => {
        mockLogin.mockResolvedValue({ id: 1, username: 'john_doe' });
        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('your_username'), {
            target: { value: 'john_doe' }
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'TestPass123!' }
        });
        fireEvent.click(screen.getByRole('button', { name: /log in/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    /*
    test('shows error on invalid credentials', async () => {
        mockLogin.mockRejectedValueOnce({
            response: { data: { detail: 'Invalid credentials.' } }
        });
        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('your_username'), {
            target: { value: 'john_doe' }
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'wrongpass' }
        });
        fireEvent.click(screen.getByRole('button', { name: /log in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
        });
    })
    
    */;

    /*
    test('shows generic error when no response data', async () => {
        mockLogin.mockRejectedValueOnce(new Error('Network error'));
        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('your_username'), {
            target: { value: 'john_doe' }
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'wrongpass' }
        });
        fireEvent.click(screen.getByRole('button', { name: /log in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
        });

    
    });
    
    */

    /*
    test('shows loading spinner while logging in', async () => {
        mockLogin.mockReturnValue(new Promise(() => {}));
        render(<MemoryRouter><LoginPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('your_username'), {
            target: { value: 'john_doe' }
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'TestPass123!' }
        });
        fireEvent.click(screen.getByRole('button', { name: /log in/i }));

        await waitFor(() => {
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });
    */
});