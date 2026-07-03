import React from "react";
import { FaHeart, FaRegComment, FaPaperPlane } from "react-icons/fa";


export default function Feed({ query, setSelectedVideo }) {
    const videos = Array.from({ length: 8 }).map((_, i) => ({
        id: i + 1,
        title: `Chill Beats — Session ${i + 1}`,
        creator: ["Lina", "Aman", "Maya", "Ravi"][i % 4],
        thumbnail: `https://picsum.photos/seed/video${i + 1}/800/450`,
        views: Math.floor(Math.random() * 90000) + 1000,
        duration: `${Math.floor(Math.random() * 12) + 1}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
        videoUrl: `https://samplelib.com/lib/preview/mp4/sample-5s.mp4`,
    }));


    const filtered = videos.filter(v => v.title.toLowerCase().includes(query.toLowerCase()) || v.creator.toLowerCase().includes(query.toLowerCase()));


    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">For you</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">Trending • Shorts • Latest</div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(video => (
                    <article key={video.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="relative cursor-pointer" onClick={() => setSelectedVideo(video)}>
                            <img src={video.thumbnail} alt={video.title} className="w-full h-44 object-cover" />
                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">{video.duration}</div>
                        </div>


                        <div className="p-3 flex gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="font-semibold text-sm">{video.title}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{video.creator} • {video.views.toLocaleString()} views</div>
                                <div className="mt-2 flex items-center gap-3">
                                    <button className="flex items-center gap-2 text-sm"><FaHeart /> 1.2k</button>
                                    <button className="flex items-center gap-2 text-sm"><FaRegComment /> 120</button>
                                    <button className="ml-auto flex items-center gap-2 text-sm"><FaPaperPlane /></button>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}