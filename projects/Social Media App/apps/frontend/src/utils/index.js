import { formatDistanceToNow, format } from 'date-fns';

export const timeAgo = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatDate = (date) =>
  format(new Date(date), 'MMM d, yyyy');

export const formatNumber = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export const avatarUrl = (user) =>
  user?.profile_picture || null;

export const classNames = (...classes) =>
  classes.filter(Boolean).join(' ');

