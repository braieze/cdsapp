import { useState } from 'react';
import { 
  X, ChevronRight, List, CalendarDays, FileText, 
  Mic2, Music, Users, Shield, Utensils, Download, Plus 
} from 'lucide-react';

export default function Calendar() {
  const [view, setView] = useState('month'); // Por defecto vista de Mes como pediste
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Datos extendidos con todos los detalles ministeriales
  const events = [
    {
      id: 1,
      title: 'Culto de Adoración',
      date: 'Dom 19 Feb',
      day: 19,
      time: '19:00',
      color: 'bg-rose-100 text-rose-600',
      details: {
        predicador: 'Pastor Mario',
        alabanza: 'Andrea S.',
        sonido: 'Lucas G.',
        multimedia: 'Tu asignación',
        puerta: 'Juan M. y Elena R.', // Recepción/Puerta
        intercesion: 'Familia Perez',
        liturgiaUrl: '#' // Link para el PDF
      }
    }
  ];

  const daysInMonth = Array.from({ length: 28 }, (_, i) => i + 1);
  const today = 13; // Basado en la imagen

  return (
    <div className="pb-24 pt-4 px-4 animate-fade-in bg-white min-h-screen">
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Calendario Global</h2>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}><List size={20}/></button>
          <button onClick={() => setView('month')} className={`p-2 rounded-lg ${view === 'month' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400'}`}><CalendarDays size={20}/></button>
        </div>
      </div>

      {/* Selector de Fecha Estilo Imagen */}
      <div className="flex items-center justify-between border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
        <button className="text-slate-400">{'<'}</button>
        <span className="font-bold text-slate-700">Febrero 2026</span>
        <button className="text-slate-400">{'>'}</button>
      </div>

      {view === 'month' ? (
        /* VISTA CALENDARIO LITERAL */
        <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
            {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => (
              <div key={d} className="text-[10px] font-bold text-slate-400 text-center py-4">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-slate-50">
            {daysInMonth.map(day => {
              const hasEvent = events.find(e => e.day === day);
              const isToday = day === today;
              return (
                <div 
                  key={day} 
                  onClick={() => hasEvent && setSelectedEvent(hasEvent)}
                  className="h-24 border-r border-b border-slate-50 p-1 relative hover:bg-slate-50 transition-colors"
                >
                  <span className={`text-xs font-bold absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>
                    {day}
                  </span>
                  {hasEvent && (
                    <div className={`mt-8 px-1.5 py-0.5 rounded text-[9px] font-bold truncate ${hasEvent.color}`}>
                      {hasEvent.time}..
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA LISTA */
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id} onClick={() => setSelectedEvent(e)} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
              <div className="flex gap-4 items-center">
                <div className="bg-brand-50 text-brand-700 w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold">
                  <span className="text-[10px] uppercase leading-none">{e.date.split(' ')[0]}</span>
                  <span className="text-lg leading-none">{e.date.split(' ')[1]}</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{e.title}</h4>
                  <p className="text-xs text-slate-500 font-medium">{e.time} HS</p>
                </div>
              </div>
              <ChevronRight className="text-slate-300" />
            </div>
          ))}
        </div>
      )}

      {/* Botón flotante FAB */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-40">
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* FICHA TÉCNICA DETALLADA */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-800">{selectedEvent.title}</h3>
              <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">{selectedEvent.date} • {selectedEvent.time} HS</p>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-8">
              <DetailRow icon={Mic2} label="Predicación" value={selectedEvent.details.predicador} />
              <DetailRow icon={Music} label="Alabanza" value={selectedEvent.details.alabanza} />
              <DetailRow icon={Users} label="Puerta / Recepción" value={selectedEvent.details.puerta} />
              <DetailRow icon={Shield} label="Intercesión" value={selectedEvent.details.intercesion} />
              <div className="grid grid-cols-2 gap-4">
                <DetailRow icon={Utensils} label="Sonido" value={selectedEvent.details.sonido} small />
                <DetailRow icon={FileText} label="Multimedia" value={selectedEvent.details.multimedia} small />
              </div>
            </div>

            {/* Botón Descargar Liturgia (PDF) */}
            <a 
              href={selectedEvent.details.liturgiaUrl}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Download size={20} /> Descargar Liturgia (PDF)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente auxiliar para las filas de detalles
function DetailRow({ icon: Icon, label, value, small }) {
  return (
    <div className={`flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 ${small ? 'p-3' : ''}`}>
      <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600"><Icon size={small ? 16 : 20}/></div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
        <p className={`${small ? 'text-xs' : 'text-sm'} font-bold text-slate-700`}>{value}</p>
      </div>
    </div>
  );
}