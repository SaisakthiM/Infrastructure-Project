import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { notifsAPI } from '../api';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { timeAgo } from '../utils';

const LABELS = {
  like:    (sender) => <><span className="font-semibold text-white">{sender}</span> liked your post</>,
  comment: (sender) => <><span className="font-semibold text-white">{sender}</span> commented on your post</>,
  follow:  (sender) => <><span className="font-semibold text-white">{sender}</span> started following you</>,
  mention: (sender) => <><span className="font-semibold text-white">{sender}</span> mentioned you</>,
  reply:   (sender) => <><span className="font-semibold text-white">{sender}</span> replied to your comment</>,
};

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notifsAPI.list().then(({ data }) => {
      setNotifs(data.results);
      setLoading(false);
      notifsAPI.markRead().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Notifications</h1>

      {loading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}

      {!loading && notifs.length === 0 && (
        <div className="text-center py-20 text-white/30">
          <p className="text-4xl mb-3">🔔</p>
          <p className="font-medium">No notifications yet</p>
        </div>
      )}

      <div className="space-y-1">
        {notifs.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
              !n.is_read ? 'bg-violet-500/8' : 'hover:bg-white/4'
            }`}
          >
            <Link to={`/profile/${n.sender.username}`} className="flex-shrink-0 relative">
              <Avatar user={n.sender} size="md" />
              {!n.is_read && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-[#0d0d0d]" />
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 leading-snug">
                {LABELS[n.notif_type]?.(n.sender.profile_name || n.sender.username) ?? n.notif_type}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{timeAgo(n.created_at)}</p>
            </div>

            {n.post?.media?.[0] && (
              <img
                src={n.post.media[0].file}
                alt=""
                className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

