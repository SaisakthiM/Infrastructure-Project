import { getInitials } from '../../utils';

const sizes = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-14 h-14 text-base',
  xl:  'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-2xl',
};

export default function Avatar({ user, size = 'md', className = '', ring = false, onClick }) {
  const sizeClass = sizes[size] || sizes.md;
  const ringClass = ring ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0d0d0d]' : '';

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
        bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-bold
        ${ringClass} ${className} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {getInitials(user?.profile_name || user?.username || '?')}
    </div>
  );
}

