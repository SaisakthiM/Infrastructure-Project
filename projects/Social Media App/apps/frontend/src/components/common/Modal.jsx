import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-full' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />
          {/* city panel: .glass gives the paper sheet + ink hairline, :has(> .hd) paints the district accent rule on top */}
          <motion.div
            className={`glass solid relative z-10 w-full ${widths[size]}`}
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={{    scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            {title && (
              <div className="hd">
                <span className="truncate">{title}</span>
                <button onClick={onClose} className="btn ghost sm" aria-label="Close">
                  <IoClose size={16} />
                </button>
              </div>
            )}
            {!title && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-2 right-2 z-10 text-white/40 hover:text-white transition-colors"
              >
                <IoClose size={20} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

