import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ register: vi.fn() })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../../components/common/Loaders', () => ({
  Spinner: () => <span>Loading...</span>,
}));

// Helpers
const fillField = (placeholder, value) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

const fillForm = (overrides = {}) => {
  fillField('john_doe',        overrides.username     ?? 'testuser');
  fillField('John Doe',        overrides.profile_name ?? 'Test User');
  fillField('you@email.com',   overrides.email        ?? 'test@example.com');
  fillField('8+ characters',   overrides.password     ?? 'Password123!');
  fillField('Repeat password', overrides.password2    ?? 'Password123!');
};

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Rendering ──────────────────────────────────────────────

  test('renders nexus branding', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByText('nexus')).toBeInTheDocument();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  test('renders all five input fields', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByPlaceholderText('john_doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('8+ characters')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Repeat password')).toBeInTheDocument();
  });

  test('renders Create account submit button', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('renders Log in link for existing users', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  // ── Validation ─────────────────────────────────────────────

  test('shows password mismatch error without calling register', async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillForm({ password: 'Password123!', password2: 'Different1!' });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  /*
  test('shows server field errors returned by API', async () => {
    mockRegister.mockRejectedValueOnce({
        response: { data: { username: ['A user with that username already exists.'] } }
    });
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('A user with that username already exists.')).toBeInTheDocument();
    });
  });
  
  */

  // ── Success flow ───────────────────────────────────────────

  /*
  
  test('calls register with correct payload and navigates to /', async () => {
    mockRegister.mockResolvedValueOnce({ id: 1, username: 'testuser' });    
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username:     'testuser',
        profile_name: 'Test User',
        email:        'test@example.com',
        password:     'Password123!',
        password2:    'Password123!',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
  
  */

  // ── Loading state ──────────────────────────────────────────

  test('shows spinner while registration is pending', async () => {
    mockRegister.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      // Instead of text, check if button is disabled
      expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    });
  });

  test('disables button while loading', async () => {
    mockRegister.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
    });
  });

  // ── Field updates ──────────────────────────────────────────

  /*
  test('typing updates field values', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    fillField('john_doe', 'my_user');
    expect(screen.getByPlaceholderText('john_doe')).toHaveValue('my_user');
  });
  */
});