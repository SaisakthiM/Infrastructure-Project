import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAdd, IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { storiesAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';

export default function StoriesBar() {
  const { user }              = useAuth();
  const [groups, setGroups]   = useState([]);
  const [viewer, setViewer]   = useState(null); // { groupIdx, storyIdx }
  const fileRef               = useRef(null);

  useEffect(() => {
    storiesAPI.feed().then(({ data }) => setGroups(data)).catch(() => {});
  }, []);

  const uploadStory = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('media', file);
    try {
      await storiesAPI.create(fd);
      const { data } = await storiesAPI.feed();
      setGroups(data);
    } catch {}
  };

  const openStory = (gIdx) => {
    setViewer({ groupIdx: gIdx, storyIdx: 0 });
    const story = groups[gIdx]?.stories[0];
    if (story) storiesAPI.view(story.id).catch(() => {});
  };

  const next = () => {
    const g = groups[viewer.groupIdx];
    if (viewer.storyIdx < g.stories.length - 1) {
      const next = { ...viewer, storyIdx: viewer.storyIdx + 1 };
      setViewer(next);
      storiesAPI.view(g.stories[next.storyIdx].id).catch(() => {});
    } else if (viewer.groupIdx < groups.length - 1) {
      setViewer({ groupIdx: viewer.groupIdx + 1, storyIdx: 0 });
    } else {
      setViewer(null);
    }
  };

  const prev = () => {
    if (viewer.storyIdx > 0) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx - 1 });
    } else if (viewer.groupIdx > 0) {
      const prevGroup = groups[viewer.groupIdx - 1];
      setViewer({ groupIdx: viewer.groupIdx - 1, storyIdx: prevGroup.stories.length - 1 });
    }
  };

  const currentStory = viewer ? groups[viewer.groupIdx]?.stories[viewer.storyIdx] : null;
  const currentGroup = viewer ? groups[viewer.groupIdx] : null;

  return (
    <>
      {/* Stories bar */}
      <div className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-hide">
        {/* Add story */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-14 h-14 rounded-full bg-white/5 border-2 border-dashed border-white/20 hover:border-violet-500 flex items-center justify-center transition-all"
          >
            <IoAdd size={20} className="text-white/50" />
          </button>
          <span className="text-[10px] text-white/40">Your story</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadStory} />
        </div>

        {/* Story groups */}
        {groups.map((g, i) => (
          <button
            key={g.user.id}
            onClick={() => openStory(i)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className={`p-[2px] rounded-full ${g.has_unseen ? 'bg-gradient-to-tr from-violet-500 to-fuchsia-500' : 'bg-white/10'}`}>
              <div className="p-0.5 rounded-full bg-[#0d0d0d]">
                <Avatar user={g.user} size="md" />
              </div>
            </div>
            <span className="text-[10px] text-white/60 truncate w-14 text-center">{g.user.username}</span>
          </button>
        ))}
      </div>

      {/* Story viewer modal */}
      <AnimatePresence>
        {viewer && currentStory && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Progress bar */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-white rounded-full ${i < viewer.storyIdx ? 'w-full' : i === viewer.storyIdx ? 'animate-story-progress' : 'w-0'}`}
                  />
                </div>
              ))}
            </div>

            {/* Author */}
            <div className="absolute top-10 left-4 flex items-center gap-2 z-10">
              <Avatar user={currentGroup.user} size="sm" ring />
              <span className="text-white text-sm font-semibold">{currentGroup.user.username}</span>
            </div>

            {/* Close */}
            <button onClick={() => setViewer(null)} className="absolute top-4 right-4 z-10 text-white/60 hover:text-white">
              <IoClose size={24} />
            </button>

            {/* Media */}
            {currentStory.media_type === 'video' ? (
              <video
                src={currentStory.media}
                autoPlay
                className="max-h-screen max-w-full object-contain"
                onEnded={next}
              />
            ) : (
              <img
                src={currentStory.media}
                alt=""
                className="max-h-screen max-w-full object-contain"
              />
            )}

            {/* Caption */}
            {currentStory.caption && (
              <div className="absolute bottom-16 left-4 right-4 text-white text-sm text-center bg-black/40 rounded-xl px-4 py-2">
                {currentStory.caption}
              </div>
            )}

            {/* Nav buttons */}
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2">
              <IoChevronBack size={28} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2">
              <IoChevronForward size={28} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

