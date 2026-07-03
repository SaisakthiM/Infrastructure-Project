import React from "react";
import { FaSearch, FaMoon, FaSun } from "react-icons/fa";


export default function Navbar({ query, setQuery, dark, setDark }) {
    const toggleTheme = () => {
        setDark(d => !d);
        document.documentElement.classList.toggle("dark", !dark);
    };


    return (
        <header className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 cursor-pointer">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-pink-500 to-yellow-400 flex items-center justify-center font-bold text-white">SF</div>
                    <span className="font-semibold text-lg">SocialFuse</span>
                </div>


                <div className="hidden md:flex items-center bg-white dark:bg-gray-800 border rounded-xl px-3 py-2 gap-2 shadow-sm">
                    <FaSearch className="text-gray-400" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search creators, videos..." className="bg-transparent outline-none w-64 text-sm" />
                    <button className="ml-2 text-sm px-2 py-1 rounded-md bg-blue-600 text-white">Search</button>
                </div>
            </div>


            <div className="flex items-center gap-3">
                <button onClick={toggleTheme} title="Toggle theme" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800">
                    {dark ? <FaSun /> : <FaMoon />}
                </button>
                <button className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-white">Subscribe</button>
                <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
        </header>
    );
}