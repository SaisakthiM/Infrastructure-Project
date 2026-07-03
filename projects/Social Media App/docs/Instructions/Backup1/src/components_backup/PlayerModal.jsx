import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeart, FaRegComment, FaPaperPlane } from "react-icons/fa";


export default function PlayerModal({ selectedVideo, setSelectedVideo }) {
    return (
        <AnimatePresence>
            {selectedVideo && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
                        <div className="relative">
                            <video controls className="w-full h-72 bg-black">
                                <source src={selectedVideo.videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            <button onClick={() => setSelectedVideo(null)} className="absolute top-3 right-3 bg-black bg-opacity-30 text-white rounded-full p-2">✕</button>
                        </div>


                        <div className="p-4">
                            <h3 className="text-lg font-semibold">{selectedVideo.title}</h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{selectedVideo.creator} • {selectedVideo.views.toLocaleString()} views</div>


                            <div className="mt-4 flex items-center gap-3">
                                <button className="flex items-center gap-2 px-3 py-1 rounded bg-red-500 text-white">Play Playlist</button>
                                <button className="flex items-center gap-2 px-3 py-1 rounded border">Save</button>
                                <div className="ml-auto flex items-center gap-3">
                                    <button className="flex items-center gap-2"><FaHeart /></button>
                                    <button className="flex items-center gap-2"><FaRegComment /></button>
                                    <button className="flex items-center gap-2"><FaPaperPlane /></button>
                                </div>
                            </div>


                            <div className="mt-4">
                                <h4 className="font-medium">Comments</h4>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">No comments yet — be the first to comment!</div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}