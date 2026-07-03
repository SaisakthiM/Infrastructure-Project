import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { IoCloudUploadOutline, IoClose, IoImageOutline } from 'react-icons/io5';
import Modal from '../common/Modal';
import { postsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { Spinner } from '../common/Loaders';
import { toast } from 'react-toastify';

export default function CreatePostModal({ open, onClose }) {
  const { user }             = useAuth();
  const [content, setContent]   = useState('');
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading]   = useState(false);
  const fileRef                 = useRef(null);

  const handleFiles = (selected) => {
    const arr = Array.from(selected).slice(0, 10);
    setFiles(arr);
    setPreviews(arr.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (i) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!content.trim() && files.length === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      files.forEach((f) => fd.append('media', f));
      await postsAPI.create(fd);
      toast.success('Post shared!');
      setContent('');
      setFiles([]);
      setPreviews([]);
      onClose();
    } catch {
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setContent('');
    setFiles([]);
    setPreviews([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create post" size="md">
      <div className="p-4 space-y-4">
        {/* Author */}
        <div className="flex items-center gap-3">
          <Avatar user={user} size="md" />
          <div>
            <p className="text-sm font-semibold">{user?.profile_name || user?.username}</p>
            <p className="text-xs text-white/40">@{user?.username}</p>
          </div>
        </div>

        {/* Text input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full bg-transparent text-white/90 placeholder-white/25 text-sm leading-relaxed resize-none outline-none"
          autoFocus
        />

        {/* Media previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square group">
                {p.type.startsWith('video') ? (
                  <video src={p.url} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <IoClose size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload zone */}
        {previews.length === 0 && (
          <div
            className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <IoCloudUploadOutline size={28} className="mx-auto text-white/30 mb-2" />
            <p className="text-sm text-white/40">Drop photos/videos here or <span className="text-violet-400">browse</span></p>
          </div>
        )}

        {previews.length > 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <IoImageOutline size={16} /> Add more
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-xs text-white/25">{content.length} chars</span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading || (!content.trim() && files.length === 0)}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              {loading && <Spinner size="sm" />}
              Share
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

