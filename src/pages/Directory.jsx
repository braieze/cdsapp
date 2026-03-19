import { useState, useEffect, useMemo } from 'react'; // ✅ useMemo para velocidad
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { 
  Search, Shield, Briefcase, Camera, Loader2, Save, X, Phone, 
  UserPlus, MapPin, Calendar as CalendarIcon, Mail, CheckCircle, 
  AlertCircle, MessageCircle, QrCode, Trash2, Heart 
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react'; 
import imageCompression from 'browser-image-compression';

export default function Directory() {
  const { dbUser } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  
  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 

  const [newUser, setNewUser] = useState({ displayName: '', role: 'miembro', area: 'ninguna', phone: '' });

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // ✅ FUNCIÓN PARA LIMPIAR WHATSAPP (Arregla el error de número inválido)
  const formatWhatsApp = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Quita todo lo que no sea número
    
    // Si el número empieza con 11 o 15 y tiene 10 dígitos (Formato Arg local)
    // le agregamos el código de país 54 y el 9 de celular para WhatsApp
    if (cleaned.length === 10 && (cleaned.startsWith('11') || cleaned.startsWith('15'))) {
      cleaned = '549' + cleaned;
    }
    
    // Si ya tiene el 54 pero le falta el 9 antes del 11 (Común en Arg)
    if (cleaned.startsWith('5411') && cleaned.length === 12) {
      cleaned = '549' + cleaned.slice(2);
    }

    return cleaned;
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          finalName: data.displayName || data.name || 'Sin Nombre' 
        };
      });
      usersData.sort((a, b) => a.finalName.localeCompare(b.finalName));
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveUser = async () => {
    if (!editingUser || dbUser?.role !== 'pastor') return;
    setSaveStatus('saving');
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await setDoc(userRef, {
        ...editingUser,
        displayName: editingUser.finalName,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => { setEditingUser(null); setSaveStatus('idle'); }, 1000);
    } catch (error) {
      setSaveStatus('idle');
      alert("Error al guardar: " + error.message);
    }
  };

  const handleDeleteMember = async (id, name) => {
    if (dbUser?.role !== 'pastor') return;
    if (window.confirm(`¿ELIMINAR A ${name}? Esta acción es permanente.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setEditingUser(null);
      } catch (e) { alert("Error"); }
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.displayName.trim()) return alert("El nombre es obligatorio");
    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        ...newUser,
        createdAt: serverTimestamp()
      });
      setIsCreating(false);
      setNewUser({ displayName: '', role: 'miembro', area: 'ninguna', phone: '' });
    } catch (error) { alert("Error"); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || dbUser?.role !== 'pastor') return;
    setUploading(true);
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("upload_preset", UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await response.json();
      if (data.secure_url) {
        const userRef = doc(db, 'users', editingUser.id);
        await setDoc(userRef, { photoURL: data.secure_url }, { merge: true });
        setEditingUser({ ...editingUser, photoURL: data.secure_url });
      }
    } catch (error) { console.error(error); } finally { setUploading(false); }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.finalName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'Todos' || u.role?.toLowerCase() === activeFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  // ✅ OPTIMIZACIÓN: Memoizamos la agrupación para que al escribir no laguee
  const groupedUsers = useMemo(() => {
    return filteredUsers.reduce((acc, user) => {
      const letter = (user.finalName[0] || '#').toUpperCase();
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(user);
      return acc;
    }, {});
  }, [filteredUsers]);

  const alphabet = Object.keys(groupedUsers).sort();

  return (
    <div className="pb-24 bg-slate-50 min-h-screen animate-fade-in p-4 font-outfit">
      
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Directorio</h1>
        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Base de datos de la Iglesia ({users.length})</p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-2">
        {['Todos', 'Pastor', 'Lider', 'Servidor', 'Miembro'].map(f => (
          <button 
            key={f} onClick={() => setActiveFilter(f)}
            className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === f ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-[25px] shadow-sm border border-slate-100 mb-6 flex items-center gap-2 sticky top-4 z-10">
        <Search className="text-slate-400" size={20}/>
        <input 
          type="text" placeholder="Buscar por nombre..." 
          className="flex-1 outline-none text-slate-700 font-bold bg-transparent"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {loading && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-brand-600"/></div>}
        
        {alphabet.map(letter => (
          <div key={letter}>
            <div className="flex items-center gap-4 mb-3 px-2">
               <span className="text-xl font-black text-slate-300">{letter}</span>
               <div className="h-[1px] flex-1 bg-slate-200"></div>
            </div>
            <div className="space-y-3">
              {groupedUsers[letter].map(user => (
                <div 
                  key={user.id} 
                  onClick={() => { setEditingUser(user); setSaveStatus('idle'); }}
                  className="bg-white p-3 rounded-[22px] border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-slate-100 border-2 border-white shadow-sm">
                    <img 
                       src={user.photoURL || `https://ui-avatars.com/api/?name=${user.finalName}&background=0f172a&color=fff`} 
                       className="w-full h-full object-cover"
                       loading="lazy" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-sm truncate uppercase">{user.finalName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${user.role === 'pastor' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{user.role}</span>
                      {user.area && user.area !== 'ninguna' && <span className="text-[8px] text-brand-600 font-black uppercase">{user.area}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {['pastor', 'lider'].includes(dbUser?.role) && (
        <button 
          onClick={() => setIsCreating(true)}
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
        >
          <UserPlus size={28} />
        </button>
      )}

      {/* MODAL FICHA TÉCNICA */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[40px] animate-slide-up relative flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            
            <div className="relative h-28 bg-slate-900 shrink-0">
               <button onClick={() => setEditingUser(null)} className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full"><X size={20}/></button>
               <div className="absolute -bottom-10 left-0 right-0 flex justify-center">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[30px] overflow-hidden border-4 border-white shadow-lg bg-white">
                      <img src={editingUser.photoURL || `https://ui-avatars.com/api/?name=${editingUser.finalName}`} className="w-full h-full object-cover" />
                    </div>
                    {dbUser?.role === 'pastor' && (
                      <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-xl cursor-pointer shadow-md">
                        {uploading ? <Loader2 size={14} className="animate-spin"/> : <Camera size={14}/>}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                      </label>
                    )}
                  </div>
               </div>
            </div>

            <div className="pt-12 px-6 pb-8 overflow-y-auto no-scrollbar">
              <div className="text-center mb-6">
                <input 
                  disabled={dbUser?.role !== 'pastor'}
                  className="text-xl font-black text-slate-800 text-center w-full bg-transparent outline-none uppercase"
                  value={editingUser.finalName} 
                  onChange={(e) => setEditingUser({...editingUser, finalName: e.target.value})}
                />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{editingUser.email || 'Sin correo'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* 🎯 CORRECCIÓN WHATSAPP */}
                <a href={`https://wa.me/${formatWhatsApp(editingUser.phone)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-3xl border border-emerald-100 active:scale-95 transition-all text-center">
                  <MessageCircle size={20}/><span className="text-[9px] font-black uppercase">WhatsApp</span>
                </a>
                
                {/* 🎯 CORRECCIÓN GOOGLE MAPS */}
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editingUser.address || '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-3xl border border-blue-100 active:scale-95 transition-all text-center">
                  <MapPin size={20}/><span className="text-[9px] font-black uppercase">Maps</span>
                </a>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Rol</label>
                    <select disabled={dbUser?.role !== 'pastor'} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none">
                        <option value="pastor">Pastor</option><option value="lider">Líder</option><option value="servidor">Servidor</option><option value="miembro">Miembro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Área</label>
                    <input disabled={dbUser?.role !== 'pastor'} value={editingUser.area} onChange={e => setEditingUser({...editingUser, area: e.target.value.toLowerCase()})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" placeholder="sonido, etc" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Teléfono WhatsApp</label>
                  <input disabled={dbUser?.role !== 'pastor'} value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" placeholder="11..." />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Dirección Completa</label>
                  <input disabled={dbUser?.role !== 'pastor'} value={editingUser.address || ''} onChange={e => setEditingUser({...editingUser, address: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" placeholder="Calle y altura..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">DNI</label>
                      <input disabled={dbUser?.role !== 'pastor'} value={editingUser.dni || ''} onChange={e => setEditingUser({...editingUser, dni: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">G. Sangre</label>
                      <input disabled={dbUser?.role !== 'pastor'} value={editingUser.bloodType || ''} onChange={e => setEditingUser({...editingUser, bloodType: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none uppercase text-center" />
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Cumpleaños</label>
                  <input type="date" disabled={dbUser?.role !== 'pastor'} value={editingUser.birthday || ''} onChange={e => setEditingUser({...editingUser, birthday: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" />
                </div>

                {['pastor', 'lider'].includes(dbUser?.role) ? (
                  <div className="bg-rose-50 p-5 rounded-[30px] border border-rose-100 shadow-inner">
                    <label className="text-[9px] font-black text-rose-600 uppercase mb-3 block tracking-widest flex items-center gap-1.5"><Heart size={10}/> Datos de Emergencia</label>
                    <input disabled={dbUser?.role !== 'pastor'} value={editingUser.emergencyName || ''} onChange={e => setEditingUser({...editingUser, emergencyName: e.target.value})} className="w-full p-3 bg-white border border-rose-100 rounded-xl text-xs font-bold mb-3 outline-none" placeholder="Nombre contacto" />
                    <input disabled={dbUser?.role !== 'pastor'} value={editingUser.emergencyPhone || ''} onChange={e => setEditingUser({...editingUser, emergencyPhone: e.target.value})} className="w-full p-3 bg-white border border-rose-100 rounded-xl text-xs font-bold outline-none" placeholder="Teléfono contacto" />
                  </div>
                ) : (
                  <div className="p-5 bg-slate-100 rounded-[30px] flex flex-col items-center gap-2">
                    <Shield size={20} className="text-slate-400 opacity-50"/>
                    <p className="text-[8px] font-black text-slate-400 uppercase italic tracking-tighter text-center">Acceso restringido por seguridad</p>
                  </div>
                )}

                <div className="flex flex-col items-center pt-6 opacity-20 grayscale">
                  <QRCodeCanvas value={editingUser.id} size={60} />
                  <p className="text-[7px] font-mono mt-2 tracking-widest">ID: {editingUser.id.toUpperCase()}</p>
                </div>

                {dbUser?.role === 'pastor' && (
                  <div className="pt-6 space-y-3">
                    <button onClick={handleSaveUser} disabled={saveStatus !== 'idle'} className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-xl transition-all ${saveStatus === 'success' ? 'bg-green-500 text-white' : 'bg-slate-900 text-white active:scale-95'}`}>
                      {saveStatus === 'idle' ? <><Save size={18}/> Guardar Cambios</> : saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin"/> : "✓ Guardado"}
                    </button>
                    <button onClick={() => handleDeleteMember(editingUser.id, editingUser.finalName)} className="w-full py-4 text-red-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 rounded-2xl transition-colors">
                      <Trash2 size={14}/> Eliminar de la Iglesia
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 animate-scale-in relative shadow-2xl">
            <button onClick={() => setIsCreating(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full"><X size={20}/></button>
            <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Nuevo Miembro</h2>
            <div className="space-y-4">
              <input placeholder="Nombre Completo" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})}/>
              <div className="grid grid-cols-2 gap-3">
                <select className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase outline-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="miembro">Miembro</option><option value="servidor">Servidor</option><option value="lider">Líder</option><option value="pastor">Pastor</option>
                </select>
                <input placeholder="Area" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase outline-none" value={newUser.area} onChange={e => setNewUser({...newUser, area: e.target.value.toLowerCase()})}/>
              </div>
              <button onClick={handleCreateUser} className="w-full bg-brand-600 text-white font-black py-4 rounded-2xl mt-4 shadow-xl uppercase text-[10px] tracking-widest">Registrar Miembro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}