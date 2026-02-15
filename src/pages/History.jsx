import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Calendar, CheckCircle, Clock, MapPin, Award, Filter } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'events'), orderBy('date', 'desc')); // Orden desc (más reciente primero)
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtramos solo los PASADOS donde participé
      const myHistory = allEvents.filter(event => {
        const isMyEvent = event.assignments && Object.values(event.assignments).some(arr => Array.isArray(arr) && arr.includes(currentUser.displayName));
        const isPastEvent = isPast(new Date(event.date + 'T00:00:00'));
        return isMyEvent && isPastEvent;
      });

      setEvents(myHistory);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Agrupar por Mes y Año
  const groupedEvents = events.reduce((acc, event) => {
      const monthYear = format(new Date(event.date + 'T00:00:00'), 'MMMM yyyy', { locale: es });
      if (!acc[monthYear]) acc[monthYear] = [];
      acc[monthYear].push(event);
      return acc;
  }, {});

  const getMyRole = (event) => {
      const roleKey = Object.keys(event.assignments).find(key => event.assignments[key].includes(currentUser.displayName));
      return roleKey ? roleKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Servidor';
  };

  return (
    <div className="pb-24 pt-4 px-4 bg-slate-50 min-h-screen animate-fade-in">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pt-2">
          <button onClick={() => navigate(-1)} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} className="text-slate-700"/>
          </button>
          <div>
              <h1 className="text-xl font-black text-slate-800">Mi Historial</h1>
              <p className="text-xs text-slate-500">{events.length} servicios realizados</p>
          </div>
      </div>

      {/* Stats Resumen */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl mb-8 shadow-xl shadow-slate-900/20 relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-end">
              <div>
                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Acumulado</p>
                  <h2 className="text-4xl font-black">{events.length}</h2>
                  <p className="text-xs text-slate-400 mt-1">Vidas impactadas a través de tu servicio.</p>
              </div>
              <Award size={48} className="text-brand-500 opacity-80"/>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      </div>

      {/* Lista Temporal */}
      <div className="space-y-6">
          {Object.keys(groupedEvents).map(month => (
              <div key={month} className="animate-slide-up">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 ml-1">{month}</h3>
                  <div className="space-y-3">
                      {groupedEvents[month].map(event => (
                          <div key={event.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                              <div className="flex flex-col items-center justify-center min-w-[50px]">
                                  <span className="text-lg font-black text-slate-300">{format(new Date(event.date + 'T00:00:00'), 'dd')}</span>
                                  <div className="h-full w-0.5 bg-slate-100 mt-1"></div>
                              </div>
                              <div className="flex-1 pb-2">
                                  <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                  <p className="text-xs text-brand-600 font-bold mb-1">{getMyRole(event)}</p>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                      <span className="flex items-center gap-1"><Clock size={10}/> {event.time} hs</span>
                                      {event.confirmations?.[currentUser.displayName] === 'confirmed' && (
                                          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-1.5 py-0.5 rounded"><CheckCircle size={10}/> Asististe</span>
                                      )}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
          
          {events.length === 0 && (
              <div className="text-center py-10 opacity-50">
                  <Filter size={40} className="mx-auto mb-2"/>
                  <p className="text-sm">Aún no tienes servicios pasados.</p>
              </div>
          )}
      </div>
    </div>
  );
}