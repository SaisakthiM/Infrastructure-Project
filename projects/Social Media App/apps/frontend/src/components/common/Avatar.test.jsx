import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Avatar from '../../components/common/Avatar';

const userWithPicture = {
  username: 'john_doe',
  profile_name: 'John Doe',
  profile_picture: 'https://example.com/pic.jpg',
};

const userWithoutPicture = {
  username: 'jane_doe',
  profile_name: 'Jane Doe',
  profile_picture: null,
};

describe('Avatar', () => {
  test('renders an img when profile_picture is set', () => {
    render(<Avatar user={userWithPicture} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', userWithPicture.profile_picture);
    expect(img).toHaveAttribute('alt', userWithPicture.username);
  });

  test('renders initials fallback when no picture', () => {
    render(<Avatar user={userWithoutPicture} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  test('derives initials from username when profile_name is absent', () => {
    render(<Avatar user={{ username: 'alice_smith' }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  test('applies ring class when ring prop is true', () => {
    const { container } = render(<Avatar user={userWithoutPicture} ring />);
    expect(container.firstChild.className).toMatch(/ring-2/);
  });

  test('does not apply ring class by default', () => {
    const { container } = render(<Avatar user={userWithoutPicture} />);
    expect(container.firstChild.className).not.toMatch(/ring-2/);
  });

  test('calls onClick when clicked (img variant)', () => {
    const onClick = vi.fn();
    render(<Avatar user={userWithPicture} onClick={onClick} />);
    fireEvent.click(screen.getByRole('img'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('calls onClick when clicked (initials variant)', () => {
    const onClick = vi.fn();
    render(<Avatar user={userWithoutPicture} onClick={onClick} />);
    fireEvent.click(screen.getByText('JD'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('renders question mark initials for undefined user', () => {
    render(<Avatar user={undefined} />);
    // getInitials('?') => '?'
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  test('applies md size class by default', () => {
    const { container } = render(<Avatar user={userWithoutPicture} />);
    expect(container.firstChild.className).toMatch(/w-10/);
  });

  test('applies xl size class when size="xl"', () => {
    const { container } = render(<Avatar user={userWithoutPicture} size="xl" />);
    expect(container.firstChild.className).toMatch(/w-20/);
  });
});