import { 
  Sun, Moon, Music, Users, BookOpen, Star, Heart, Hammer, SprayCan, Coffee, 
  Mic2, Guitar, Speaker, Car, DoorOpen, Droplets, Banknote, ClipboardList, 
  Video, Shield, User, Sparkles, Smile 
} from 'lucide-react';

export const EVENT_TYPES = {
  // --- CULTOS Y REUNIONES GENERALES ---
  culto: { 
    label: 'Culto General', 
    icon: Sun, 
    color: 'bg-orange-100 text-orange-600 border-orange-200',
    dot: 'bg-orange-500',
    structure: [
      {
        section: 'Pastoral / Espiritual',
        roles: [
          { key: 'predicador', label: 'Predicador', icon: User, type: 'single' },
          { key: 'oracion_inicio', label: 'Oración de Inicio', icon: Sparkles, type: 'single' },
          { key: 'palabra_ofrenda', label: 'Palabra de Ofrenda', icon: Banknote, type: 'single' }
        ]
      },
      {
        section: 'Alabanza & Adoración',
        roles: [
          { key: 'lider_alabanza', label: 'Líder de Alabanza', icon: Mic2, type: 'single' },
          { key: 'voces', label: 'Voces / Coros', icon: Mic2, type: 'multi' },
          { key: 'teclado', label: 'Teclado / Piano', icon: Music, type: 'single' },
          { key: 'guitarra_acustica', label: 'Guitarra Acústica', icon: Guitar, type: 'single' },
          { key: 'guitarra_electrica', label: 'Guitarra Eléctrica', icon: Guitar, type: 'single' },
          { key: 'bajo', label: 'Bajo', icon: Guitar, type: 'single' },
          { key: 'bateria', label: 'Batería', icon: Speaker, type: 'single' }
        ]
      },
      {
        section: 'Operativo / Ujieres',
        roles: [
          { key: 'puerta', label: 'Bienvenida / Puerta', icon: DoorOpen, type: 'multi' },
          { key: 'pasillo', label: 'Pasillo / Acomodadores', icon: User, type: 'multi' },
          { key: 'seguridad_autos', label: 'Seguridad Autos', icon: Car, type: 'multi' },
          { key: 'banos', label: 'Control Baños', icon: Droplets, type: 'multi' },
          { key: 'altar', label: 'Ministración Altar', icon: Heart, type: 'multi' },
          { key: 'ofrenda', label: 'Recolección Ofrenda', icon: Banknote, type: 'multi' },
          { key: 'asistencia', label: 'Control Asistencia', icon: ClipboardList, type: 'single' }
        ]
      },
      {
        section: 'Multimedia',
        roles: [
          { key: 'lider_multimedia', label: 'Líder Multimedia', icon: Video, type: 'single' },
          { key: 'proyeccion', label: 'Proyección / Letras', icon: Video, type: 'single' },
          { key: 'transmision', label: 'Transmisión / Cámaras', icon: Video, type: 'multi' }
        ]
      }
    ]
  },

  // --- REUNIONES ESPECÍFICAS (Heredan estructura similar al culto pero simplificada) ---
  jovenes: { 
    label: 'Reunión de Jóvenes', 
    icon: Star, 
    color: 'bg-purple-100 text-purple-600 border-purple-200',
    dot: 'bg-purple-500',
    structure: 'same_as_culto' // Usaremos la misma lógica
  },
  mujeres: { 
    label: 'Reunión de Mujeres', 
    icon: Heart, 
    color: 'bg-pink-100 text-pink-600 border-pink-200',
    dot: 'bg-pink-500',
    structure: 'same_as_culto'
  },
  hombres: { 
    label: 'Reunión de Hombres', 
    icon: Users, 
    color: 'bg-blue-100 text-blue-600 border-blue-200',
    dot: 'bg-blue-500',
    structure: 'same_as_culto'
  },
  pioneros: { 
    label: 'Pioneros en la Fe', 
    icon: BookOpen, 
    color: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    dot: 'bg-emerald-500',
    structure: 'same_as_culto'
  },

  // --- ENSAYOS (Solo Música y Técnica) ---
  ensayo: { 
    label: 'Ensayo General', 
    icon: Music, 
    color: 'bg-indigo-100 text-indigo-600 border-indigo-200',
    dot: 'bg-indigo-500',
    structure: [
      {
        section: 'Músicos Citados',
        roles: [
          { key: 'lider_ensayo', label: 'Director de Ensayo', icon: Mic2, type: 'single' },
          { key: 'voces', label: 'Voces', icon: Mic2, type: 'multi' },
          { key: 'instrumentistas', label: 'Instrumentistas', icon: Guitar, type: 'multi' }
        ]
      },
      {
        section: 'Repertorio',
        roles: [
           // Aquí agregaremos lógica de canciones en el futuro
           { key: 'observaciones', label: 'Notas Técnicas', icon: ClipboardList, type: 'text' }
        ]
      }
    ]
  },

  // --- NUEVO: TALLER DE SANIDAD INTERIOR ---
  sanidad: { 
    label: 'Taller de Sanidad', 
    icon: Smile, 
    color: 'bg-teal-100 text-teal-600 border-teal-200',
    dot: 'bg-teal-500',
    structure: [
      {
        section: 'Liderazgo',
        roles: [
          { key: 'orador', label: 'Orador / Tallerista', icon: User, type: 'single' },
          { key: 'colaboradores', label: 'Equipo de Ministración', icon: Heart, type: 'multi' }
        ]
      },
      {
        section: 'Logística',
        roles: [
          { key: 'recepcion', label: 'Recepción', icon: ClipboardList, type: 'multi' },
          { key: 'limpieza_post', label: 'Limpieza Post-Taller', icon: SprayCan, type: 'multi' }
        ]
      }
    ]
  },

  // --- LIMPIEZA Y MANTENIMIENTO ---
  limpieza: { 
    label: 'Jornada de Limpieza', 
    icon: SprayCan, 
    color: 'bg-cyan-100 text-cyan-600 border-cyan-200',
    dot: 'bg-cyan-500',
    structure: [
      {
        section: 'Equipo Asignado',
        roles: [
          { key: 'lider_limpieza', label: 'Responsable', icon: Shield, type: 'single' },
          { key: 'voluntarios', label: 'Voluntarios', icon: User, type: 'multi' }
        ]
      }
      // Aquí agregaremos la checklist en el componente visual
    ]
  },

  mantenimiento: { 
    label: 'Mantenimiento', 
    icon: Hammer, 
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
    structure: 'same_as_limpieza'
  },

  // --- AYUNOS (Lógica Especial) ---
  ayuno: { 
    label: 'Ayuno Congregacional', 
    icon: Coffee, 
    color: 'bg-rose-100 text-rose-600 border-rose-200',
    dot: 'bg-rose-500',
    structure: [] // Estructura vacía porque usa lógica personalizada de Grid
  },
  
  especial: { 
    label: 'Evento Especial', 
    icon: Moon, 
    color: 'bg-yellow-100 text-yellow-600 border-yellow-200',
    dot: 'bg-yellow-500',
    structure: 'same_as_culto'
  }
};