

import React from "react";


export default function Suggested() {
    return (
        <section className="mt-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h4 className="font-medium mb-2">Suggested</h4>
            <div className="flex items-center gap-3">
                <img src="https://picsum.photos/seed/suggest1/80" className="w-12 h-12 rounded-full object-cover" />
                <div>
                    <div className="text-sm font-semibold">Kunal</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">+ Follow</div>
                </div>
                <button className="ml-auto text-sm px-2 py-1 rounded bg-blue-600 text-white">Follow</button>
            </div>
        </section>
    );
}