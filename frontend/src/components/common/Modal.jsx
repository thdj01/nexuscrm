import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  topOffset = 'default',
  bodyMaxHeight,
  panelClassName = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm:  'max-w-md',
    md:  'max-w-2xl',
    lg:  'max-w-4xl',
    xl:  'max-w-6xl',
    customer: 'max-w-[820px]',
    xxl: 'max-w-[95vw]',
  }[size] || 'max-w-2xl';

  const offsetClass = topOffset === 'topbar'
    ? 'top-[76px] bottom-0 left-0 right-0'
    : 'inset-0';

  const modalBodyMaxHeight = bodyMaxHeight || (
    topOffset === 'topbar' ? 'calc(100vh - 11rem)' : 'calc(100vh - 7rem)'
  );

  const modalContent = (
    <div className={`fixed ${offsetClass} z-50 overflow-y-auto`}>
      <div className={`fixed ${offsetClass} bg-black/50 transition-opacity`} onClick={onClose} />
      <div className={`flex min-h-full items-start justify-center p-3 sm:p-4 ${topOffset === 'topbar' ? 'py-4' : 'py-6 sm:py-8'}`}>
        <div className={`relative bg-white rounded-xl shadow-2xl w-full ${sizeClass} fade-in ${panelClassName}`}>
          <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 pr-2 truncate">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0">
              <X size={18} />
            </button>
          </div>
          <div className={`p-4 sm:p-6 overflow-y-auto ${bodyClassName}`} style={{ maxHeight: modalBodyMaxHeight }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
