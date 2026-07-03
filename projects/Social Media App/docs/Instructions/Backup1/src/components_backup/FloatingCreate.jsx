import React from "react";
import { FaPlus } from "react-icons/fa";


export default function FloatingCreate() {
    return (
        <button className="fixed right-6 bottom-6 bg-blue-600 text-white p-4 rounded-full shadow-lg flex items-center gap-2">
            <FaPlus /> <span className="hidden sm:inline">Create</span>
        </button>
    );
}