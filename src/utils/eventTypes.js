import { Sun, Moon, Music, Users, BookOpen, Star, Heart, Hammer, SprayCan, Coffee } from 'lucide-react';

export const EVENT_TYPES = {
  culto: { 
    label: 'Culto General', 
    icon: Sun, 
    color: 'bg-orange-100 text-orange-600 border-orange-200',
    dot: 'bg-orange-500'
  },
  jovenes: { 
    label: 'Reunión de Jóvenes', 
    icon: Star, 
    color: 'bg-purple-100 text-purple-600 border-purple-200',
    dot: 'bg-purple-500'
  },
  mujeres: { 
    label: 'Reunión de Mujeres', 
    icon: Heart, 
    color: 'bg-pink-100 text-pink-600 border-pink-200',
    dot: 'bg-pink-500'
  },
  hombres: { 
    label: 'Reunión de Hombres', 
    icon: Users, 
    color: 'bg-blue-100 text-blue-600 border-blue-200',
    dot: 'bg-blue-500'
  },
  pioneros: { 
    label: 'Pioneros en la Fe', 
    icon: BookOpen, 
    color: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  ensayo: { 
    label: 'Ensayo', 
    icon: Music, 
    color: 'bg-indigo-100 text-indigo-600 border-indigo-200',
    dot: 'bg-indigo-500'
  },
  limpieza: { 
    label: 'Limpieza', 
    icon: SprayCan, 
    color: 'bg-cyan-100 text-cyan-600 border-cyan-200',
    dot: 'bg-cyan-500'
  },
  mantenimiento: { 
    label: 'Mantenimiento', 
    icon: Hammer, 
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-500'
  },
  ayuno: { 
    label: 'Ayuno Congregacional', 
    icon: Coffee, 
    color: 'bg-rose-100 text-rose-600 border-rose-200',
    dot: 'bg-rose-500'
  },
  especial: { 
    label: 'Evento Especial', 
    icon: Moon, 
    color: 'bg-yellow-100 text-yellow-600 border-yellow-200',
    dot: 'bg-yellow-500'
  }
};