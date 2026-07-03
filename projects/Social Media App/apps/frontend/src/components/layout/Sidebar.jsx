import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notifsAPI } from '../../api';
import Avatar from '../common/Avatar';
import {
  IoHomeOutline, IoHome,
  IoSearchOutline, IoSearch,
  IoCompassOutline, IoCompass,
  IoFilmOutline, IoFilm,
  IoChatbubbleOutline, IoChatbubble,
  IoHeartOutline, IoHeart,
  IoAddCircleOutline, IoPersonOutline, IoPerson,
  IoLogOutOutline,
} from 'react-icons/io5';

export default function Sidebar({ onCreatePost }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await notifsAPI.unread();
        setUnread(data.count);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { to: '/',            label: 'Home',          icon: IoHomeOutline,      activeIcon: IoHome         },
    { to: '/search',      label: 'Search',        icon: IoSearchOutline,    activeIcon: IoSearch       },
    { to: '/explore',     label: 'Explore',       icon: IoCompassOutline,   activeIcon: IoCompass      },
    { to: '/reels',       label: 'Reels',         icon: IoFilmOutline,      activeIcon: IoFilm         },
    { to: '/messages',    label: 'Messages',      icon: IoChatbubbleOutline,activeIcon: IoChatbubble   },
    { to: '/notifications', label: 'Notifications', icon: IoHeartOutline,   activeIcon: IoHeart, badge: unread },
    { to: `/profile/${user?.username}`, label: 'Profile', icon: IoPersonOutline, activeIcon: IoPerson },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[72px] xl:w-56 bg-[#0a0a0a] border-r border-white/5 z-40 py-6 px-3 xl:px-4">
        {/* Logo */}
        <div className="mb-8 px-2 xl:px-0">
          <span className="text-xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent hidden xl:block">
            nexus
          </span>
          <span className="text-2xl xl:hidden">⬡</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${isActive
                  ? 'bg-white/8 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}
              `}
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex-shrink-0">
                    {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="hidden xl:block text-sm font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Create post */}
          <button
            onClick={onCreatePost}
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all mt-1"
          >
            <IoAddCircleOutline size={22} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm font-medium">Create</span>
          </button>
        </nav>

        {/* User + logout */}
        <div className="mt-4 border-t border-white/5 pt-4 space-y-1">
          <button
            onClick={() => navigate(`/profile/${user?.username}`)}
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 w-full transition-all"
          >
            <Avatar user={user} size="sm" />
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.profile_name || user?.username}</p>
              <p className="text-[11px] text-white/40">@{user?.username}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
          >
            <IoLogOutOutline size={20} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/5 z-40 flex items-center justify-around px-2 py-2">
        {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[6]].map(({ to, label, icon: Icon, activeIcon: ActiveIcon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${isActive ? 'text-white' : 'text-white/40'}`
            }
          >
            {({ isActive }) => (
              <span className="relative">
                {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
        <button onClick={onCreatePost} className="text-white/40 hover:text-white transition-all px-3 py-1">
          <IoAddCircleOutline size={24} />
        </button>
      </nav>
    </>
  );
}

