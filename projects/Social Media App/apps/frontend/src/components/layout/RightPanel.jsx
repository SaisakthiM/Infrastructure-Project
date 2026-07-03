import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../hooks';
import Avatar from '../common/Avatar';
import { UserCardSkeleton } from '../common/Loaders';

function SuggestedUser({ user }) {
  const { following, toggle } = useFollow(user.username, false);

  return (
    <div className="flex items-center justify-between">
      <Link to={`/profile/${user.username}`} className="flex items-center gap-2.5 group min-w-0">
        <Avatar user={user} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate leading-tight">
            {user.profile_name || user.username}
          </p>
          <p className="text-xs text-white/30 truncate">@{user.username}</p>
        </div>
      </Link>
      <button
        onClick={toggle}
        className={`flex-shrink-0 ml-2 text-xs font-semibold transition-colors ${
          following ? 'text-white/40 hover:text-white' : 'text-violet-400 hover:text-violet-300'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

export default function RightPanel() {
  const { user }              = useAuth();
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    usersAPI.suggested().then(({ data }) => {
      setSuggested(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Logged-in user */}
      <div className="flex items-center gap-3">
        <Avatar user={user} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{user?.profile_name || user?.username}</p>
          <p className="text-xs text-white/40 truncate">@{user?.username}</p>
        </div>
        <Link to={`/profile/${user?.username}`} className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0">
          View
        </Link>
      </div>

      {/* Suggestions */}
      {(loading || suggested.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Suggested for you</p>
          </div>
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <UserCardSkeleton key={i} />)
              : suggested.map((u) => <SuggestedUser key={u.id} user={u} />)
            }
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/15 leading-relaxed">
        © 2025 Nexus · Built with React + Django
      </p>
    </div>
  );
}

