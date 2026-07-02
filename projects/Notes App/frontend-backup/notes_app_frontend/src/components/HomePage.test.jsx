// HomePage.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        Link: ({ children }) => children
    };
});

vi.mock('./AuthContext.jsx', () => ({
    useAuth: () => ({ logout: mockLogout })
}));

describe('HomePage', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders dashboard heading', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        expect(screen.getByText('Notes Dashboard')).toBeInTheDocument();
    });

    test('renders add new note button', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        expect(screen.getByText('➕ Add New Note')).toBeInTheDocument();
    });

    test('renders logout button', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    test('renders mock notes', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
        expect(screen.getByText('Grocery List')).toBeInTheDocument();
    });

    test('clicking add note navigates to /addnote', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        fireEvent.click(screen.getByText('➕ Add New Note'));
        expect(mockNavigate).toHaveBeenCalledWith('/addnote');
    });

    test('clicking logout calls logout and navigates to /login', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        fireEvent.click(screen.getByText('Logout'));
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('clicking edit navigates to /modifynote with noteId', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/modifynote', {
            state: { noteId: 1 }
        });
    });

    test('clicking delete navigates to /deletenote with noteId', () => {
        render(<MemoryRouter><HomePage /></MemoryRouter>);
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/deletenote', {
            state: { noteId: 1 }
        });
    });
});