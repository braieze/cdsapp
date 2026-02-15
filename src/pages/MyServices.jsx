import { Calendar, Clock, MapPin, AlertCircle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

export default function MyServices() {
  // Datos de prueba (Luego vendrán de Firebase según el usuario logueado)
  const services = [
    {
      id: 1,
      ministry: 'Multimedia',
      role: 'Sonido Principal',
      event: 'Culto General',
      date: '19',
      month: 'FEB',
      dayName: 'Domingo',
      time: '09:00 AM', // Hora de llegada al servicio
      location: 'Auditorio Principal',
      status: 'pending', // pending, confirmed, cancelled
      isNext: true // Para darle el diseño oscuro destacado
    },
    {
      id: 2,
      ministry: 'Jóvenes',
      role: 'Recepción',
      event: 'Reunión de Jóvenes',
      date: '25',
      month: 'FEB',
      dayName: 'Sábado',
      time: '19:00 PM',
      location: 'Salón Anexo',
      status: 'confirmed',
      isNext: false
    }
  ];

  return (
    <div className="pb-24 pt-4 px-4 animate-fade-in">
      
      {/* Cabecera */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Mis Servicios</h2>
        <p className="text-sm text-slate-500 mt-1">Tus próximas asignaciones ministeriales</p>
      </div>

      {/* Lista de Servicios */}
      <div className="space-y-4">
        {services.map((svc) => (
          <div 
            key={svc.id} 
            className={`relative overflow-hidden rounded-2xl p-5 shadow-sm border transition-all ${
              svc.isNext 
                ? 'bg-slate-900 border-slate-800 text-white shadow-md' 
                : 'bg-white border-slate-100 text-slate-800'
            }`}
          >
            {/* Fecha a la derecha (Como pediste en tu diseño) */}
            <div className={`absolute top-5 right-5 text-center ${svc.isNext ? 'text-brand-500' : 'text-brand-600'}`}>
              <span className="block text-2xl font-black leading-none">{svc.date}</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">{svc.month}</span>
            </div>

            {/* Mensaje Central y Detalles */}
            <div className="pr-16">
              <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wide mb-3 ${
                svc.isNext ? 'bg-white/10 text-brand-400' : 'bg-brand-50 text-brand-700'
              }`}>
                {svc.ministry}
              </span>
              
              <h3 className="text-lg font-bold mb-1 leading-tight">{svc.role}</h3>
              <p className={`text-sm font-medium mb-4 ${svc.isNext ? 'text-slate-300' : 'text-slate-500'}`}>
                {svc.event}
              </p>

              {/* Info de hora y lugar */}
              <div className="space-y-1.5 mb-5">
                <div className={`flex items-center gap-2 text-xs ${svc.isNext ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Clock size={14} />
                  <span>{svc.dayName} • Llegar a las {svc.time}</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${svc.isNext ? 'text-slate-400' : 'text-slate-500'}`}>
                  <MapPin size={14} />
                  <span>{svc.location}</span>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            {svc.status === 'pending' ? (
              <div className="flex gap-2 mt-2 pt-4 border-t border-white/10">
                {/* Botón Confirmar */}
                <button className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  svc.isNext 
                    ? 'bg-brand-500 hover:bg-brand-600 text-white' 
                    : 'bg-brand-100 hover:bg-brand-200 text-brand-700'
                }`}>
                  <CheckCircle2 size={16} /> Confirmar
                </button>
                
                {/* Botón No podré asistir (Rojo/Alerta) */}
                <button className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  svc.isNext 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100'
                }`}>
                  <XCircle size={16} /> No podré asistir
                </button>
              </div>
            ) : (
              <div className={`flex items-center justify-between mt-2 pt-4 border-t ${svc.isNext ? 'border-white/10' : 'border-slate-100'}`}>
                <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
                  <CheckCircle2 size={16} /> Asistencia Confirmada
                </div>
                <button className={`text-xs font-semibold flex items-center ${svc.isNext ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  Cambiar <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tarjeta de información/reglas del equipo */}
      <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-200 flex gap-3 items-start">
        <AlertCircle className="text-slate-400 flex-shrink-0" size={20} />
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
          Si no puedes asistir a tu servicio asignado, recuerda presionar el botón <strong className="text-red-500">"No podré asistir"</strong> con al menos 48 horas de anticipación para que tu líder pueda buscar un reemplazo y se notifique automáticamente.
        </p>
      </div>

    </div>
  );
}