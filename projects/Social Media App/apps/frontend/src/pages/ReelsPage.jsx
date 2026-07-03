import { IoFilm } from 'react-icons/io5';

export default function ReelsPage() {
  return (
    <div className="flex items-center justify-center min-h-screen text-white/20">
      <div className="text-center">
        <IoFilm size={48} className="mx-auto mb-4 opacity-30" />
        <p className="font-semibold text-lg">Reels</p>
        <p className="text-sm mt-1">Coming soon — add video Stories to get started</p>
      </div>
    </div>
  );
}

