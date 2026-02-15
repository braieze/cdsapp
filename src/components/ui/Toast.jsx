import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Se va solo a los 3 segundos
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertCircle;

  return (
    <div className={`fixed top-20 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl animate-slide-in-right ${styles[type]} max-w-[90vw]`}>
      <Icon size={20} strokeWidth={2.5} />
      <p className="font-bold text-sm">{message}</p>
      <button onClick={onClose}><X size={16} className="opacity-50 hover:opacity-100"/></button>
    </div>
  );
}