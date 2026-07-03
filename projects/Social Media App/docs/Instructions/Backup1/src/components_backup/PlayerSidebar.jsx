import React from "react";


export default function PlayerSidebar({ selectedVideo }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
            <h4 className="font-semibold mb-2">Now Playing</h4>
            {selectedVideo ? (
                <div>
                    <div className="w-full h-44 bg-black rounded-md overflow-hidden mb-3 flex items-center justify-center text-white">Player Preview</div>
                    <div className="font-medium">{selectedVideo.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{selectedVideo.creator} • {selectedVideo.views.toLocaleString()} views</div>
                    <div className="mt-3 flex items-center gap-2">
                        <button className="px-3 py-1 rounded bg-blue-600 text-white">Play</button>
                        <button className="px-3 py-1 rounded border">Save</button>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-gray-500">Select a video from feed to preview</div>
            )}
        </div>
    );
}