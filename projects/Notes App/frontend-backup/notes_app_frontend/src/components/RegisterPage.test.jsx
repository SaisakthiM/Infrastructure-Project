// RegisterPage.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './Register';
import { registerUser } from '../api/authServices.js';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('../api/authServices.js');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

describe('RegisterPage', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders register form correctly', () => {
        render(<MemoryRouter><RegisterPage /></MemoryRouter>);
        // Use getByRole to avoid ambiguity between <h1> and button
        expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go To Login' })).toBeInTheDocument();
    });

    test('typing updates username and password', () => {
        render(<MemoryRouter><RegisterPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('Username'), {
            target: { value: 'newuser' }
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'NewPass123!' }
        });

        expect(screen.getByPlaceholderText('Username')).toHaveValue('newuser');
        expect(screen.getByPlaceholderText('Password')).toHaveValue('NewPass123!');
    });

    test('shows loading state while registering', async () => {
        registerUser.mockReturnValue(new Promise(() => {}));

        render(<MemoryRouter><RegisterPage /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));

        expect(screen.getByText('Registering...')).toBeInTheDocument();
        expect(screen.getByText('Registering...')).toBeDisabled();
    });

    test('shows success message on successful registration', async () => {
        registerUser.mockResolvedValue({ id: 1, username: 'newuser' });

        render(<MemoryRouter><RegisterPage /></MemoryRouter>);

        fireEvent.change(screen.getByPlaceholderText('Username'), {
            target: { value: 'newuser' }
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'NewPass123!' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));

        await waitFor(() => {
            expect(screen.getByText('Registration successful!')).toBeInTheDocument();
        });
    });

    test('shows error message on failed registration', async () => {
        registerUser.mockRejectedValue({
            response: { data: { username: 'Username already exists' } }
        });

        render(<MemoryRouter><RegisterPage /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Register' }));

        await waitFor(() => {
            // Component calls JSON.stringify on the error object
            expect(screen.getByText(/Username already exists/)).toBeInTheDocument();
        });
    });
});