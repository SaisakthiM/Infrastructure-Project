import React from "react";


export default function ProfileCard({ selectedVideo }) {
    return (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-300" />
                <div>
                    <div className="font-semibold">{selectedVideo ? selectedVideo.creator : "Your profile"}</div>
                    <div className="text-xs text-gray-500">@{selectedVideo ? selectedVideo.creator.toLowerCase() : "you"}</div>
                </div>
                <button className="ml-auto px-3 py-1 rounded bg-blue-600 text-white">Edit Profile</button>
            </div>


            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                    <div className="font-bold">120</div>
                    <div className="text-xs text-gray-500">Posts</div>
                </div>
                <div>
                    <div className="font-bold">8.4k</div>
                    <div className="text-xs text-gray-500">Followers</div>
                </div>
                <div>
                    <div className="font-bold">304</div>
                    <div className="text-xs text-gray-500">Following</div>
                </div>
            </div>
        </div>
    );
}