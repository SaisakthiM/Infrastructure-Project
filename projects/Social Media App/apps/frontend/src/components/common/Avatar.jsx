import { getInitials } from '../../utils';

const sizes = {
  xs:  'w-6 h-6 text-note',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-14 h-14 text-base',
  xl:  'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-2xl',
};

export default function Avatar({ user, size = 'md', className = '', ring = false, onClick }) {
  const sizeClass = sizes[size] || sizes.md;
  /* an avatar is one of the few circles the registry keeps; its ring is the district accent, offset by paper */
  const ringClass = ring ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-city-bg' : '';

  if (user?.profile_picture) {
    return (
      <img
        src={user.profile_picture}
        alt={user.username}
        onClick={onClick}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${ringClass} ${className} ${onClick ? 'cursor-pointer' : ''}`}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${sizeClass} rounded-full flex-shrink-0 flex items-center justify-center
        bg-violet-400 text-white font-medium
        ${ringClass} ${className} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {getInitials(user?.profile_name || user?.username || '?')}
    </div>
  );
}

