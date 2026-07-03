// File: src/components/Stories.jsx


import React from "react";


export default function Stories() {
    const stories = [
        { id: 1, name: "Lina", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80" },
        { id: 2, name: "Aman", img: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=600&q=80" },
        { id: 3, name: "Maya", img: "https://images.unsplash.com/photo-1531123414780-fc3391a6b9a6?w=600&q=80" },
        { id: 4, name: "Ravi", img: "https://images.unsplash.com/photo-1545996124-1b8a4b4a8b9a?w=600&q=80" },
        { id: 5, name: "Zara", img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80" },
    ];


    return (
        <section className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm sticky top-4">
            <h3 className="font-semibold mb-3">Reels / Stories</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {stories.map(s => (
                    <div key={s.id} className="flex-shrink-0 text-center w-20">
                        <img src={s.img} alt={s.name} className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-pink-400" />
                        <div className="text-xs mt-1">{s.name}</div>
                    </div>
                ))}
                <div className="flex-shrink-0 w-20 flex items-center justify-center">
                    <button className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center">+</button>
                </div>
            </div>
        </section>
    );
}