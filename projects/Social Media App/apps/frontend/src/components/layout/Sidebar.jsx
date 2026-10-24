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
  const navigate = useNavigate();
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
    { to: '/', label: 'Home', icon: IoHomeOutline, activeIcon: IoHome },
    { to: '/search', label: 'Search', icon: IoSearchOutline, activeIcon: IoSearch },
    { to: '/explore', label: 'Explore', icon: IoCompassOutline, activeIcon: IoCompass },
    { to: '/reels', label: 'Reels', icon: IoFilmOutline, activeIcon: IoFilm },
    { to: '/messages', label: 'Messages', icon: IoChatbubbleOutline, activeIcon: IoChatbubble },
    { to: '/notifications', label: 'Notifications', icon: IoHeartOutline, activeIcon: IoHeart, badge: unread },
    { to: `/profile/${user?.username}`, label: 'Profile', icon: IoPersonOutline, activeIcon: IoPerson },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  /* the active item is marked by a 2px accent rule, not by a filled rounded pill */
  const navClass = ({ isActive }) =>
    `flex items-center gap-4 px-3 py-2.5 transition-colors duration-150 group relative ${
      isActive
        ? 'bg-zinc-950/5 text-violet-400 shadow-[inset_2px_0_0_var(--accent)]'
        : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-950/5'
    }`;

  return (
    <>
      {/* Desktop sidebar — starts under the HUD band: the district rail is not a civic one */}
      <aside className="hidden md:flex flex-col fixed left-0 top-[var(--hud-h)] h-[calc(100vh_-_var(--hud-h))] w-[72px] xl:w-56 border-r border-city-line z-40 py-6 px-3 xl:px-4 overflow-y-auto">
        {/* District plate — the ward code is the branding, not a gradient wordmark */}
        <div className="mb-8 px-2 xl:px-0">
          <span className="plate hidden xl:flex">
            <span className="code">D-06</span>
            <span className="name">Social</span>
          </span>
          <span className="text-2xl xl:hidden">⬡</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, badge }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navClass}>
              {({ isActive }) => (
                <>
                  <span className="relative flex-shrink-0">
                    {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                    {badge > 0 && (
                      <span className="mono absolute -top-1 -right-1 bg-violet-400 text-city-on-accent text-note w-4 h-4 rounded-full flex items-center justify-center">
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
            className="flex items-center gap-4 px-3 py-2.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-950/5 transition-colors mt-1"
          >
            <IoAddCircleOutline size={22} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm font-medium">Create</span>
          </button>
        </nav>

        {/* User + logout */}
        <div className="mt-4 border-t border-zinc-950/10 pt-4 space-y-1">
          <button
            onClick={() => navigate(`/profile/${user?.username}`)}
            className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-950/5 w-full transition-colors"
          >
            <Avatar user={user} size="sm" />
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-zinc-950 leading-tight">{user?.profile_name || user?.username}</p>
              <p className="text-mini text-zinc-500">@{user?.username}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-3 py-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-colors w-full"
          >
            <IoLogOutOutline size={20} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-city-bg border-t border-city-line z-40 flex items-center justify-around px-2 py-2">
        {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[6]].map(({ to, icon: Icon, activeIcon: ActiveIcon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                isActive ? 'text-violet-400 shadow-[inset_0_2px_0_var(--accent)]' : 'text-zinc-500'
              }`
            }
          >
            {({ isActive }) => (
              <span className="relative">
                {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                {badge > 0 && (
                  <span className="mono absolute -top-1 -right-1 bg-violet-400 text-city-on-accent text-note w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
        <button onClick={onCreatePost} className="text-zinc-500 hover:text-zinc-950 transition-colors px-3 py-1">
          <IoAddCircleOutline size={24} />
        </button>
      </nav>
    </>
  );
}
