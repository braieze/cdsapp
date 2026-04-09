import { useState, useEffect, useMemo } from 'react'; 
import { db, auth } from '../firebase';
import { 
  collection, query, onSnapshot, doc, setDoc, serverTimestamp, 
  deleteDoc, updateDoc, getDoc, writeBatch // ✅ Añadido writeBatch para la purga
} from 'firebase/firestore';
import { 
  Search, Shield, Briefcase, Camera, Loader2, Save, X, Phone, 
  UserPlus, MapPin, Calendar as CalendarIcon, Mail, CheckCircle, 
  AlertCircle, MessageCircle, QrCode, Trash2, Heart, Home, UserCheck, Star,
  ArrowRightCircle, Plus, Settings, Eraser, RefreshCw // ✅ Cambiado Broom por Eraser para evitar error de build
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
  
  // Estados para Áreas Dinámicas (Gestor de Áreas)
  const [officialAreas, setOfficialAreas] = useState(['ninguna']);
  const [isManagingAreas, setIsManagingAreas] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');
  const [isPurging, setIsPurging] = useState(false); // ✅ Estado para la purga

  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 

  const [newUser, setNewUser] = useState({ 
    displayName: '', 
    role: 'miembro', 
    area: 'ninguna', 
    phone: '', 
    address: '', 
    needsVisit: false 
  });

  const currentUser = auth.currentUser;
  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const canAddPeople = dbUser?.role === 'pastor' || dbUser?.canAddMembers === true;

  // 1. CARGAR USUARIOS
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

  // 2. CARGAR ÁREAS DESDE FIREBASE (Gestor de Áreas)
  useEffect(() => {
    const areaRef = doc(db, 'metadata', 'areas');
    const unsubscribe = onSnapshot(areaRef, (docSnap) => {
      if (docSnap.exists()) {
        setOfficialAreas(docSnap.data().list || ['ninguna']);
      } else {
        // Inicializar si no existe
        setDoc(areaRef, { list: ['ninguna', 'Alabanza', 'Ujieres', 'Multimedia'] });
      }
    });
    return () => unsubscribe();
  }, []);

  // 🎯 SCRIPT DE PURGA (Limpia áreas "basura" de la base de datos)
  const purgeInvalidAreas = async () => {
    if (!window.confirm("Esto reseteará a 'ninguna' a todos los hermanos que tengan áreas que NO están en tu lista oficial. ¿Confirmar purga?")) return;
    setIsPurging(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      const validAreasLower = officialAreas.map(a => a.toLowerCase());

      users.forEach(user => {
        const currentArea = (user.area || 'ninguna').toLowerCase();
        if (!validAreasLower.includes(currentArea)) {
          const userRef = doc(db, 'users', user.id);
          batch.update(userRef, { area: 'ninguna' });
          count++;
        }
      });

      await batch.commit();
      alert(`Purga completada. Se normalizaron ${count} perfiles.`);
    } catch (e) {
      console.error(e);
      alert("Error al limpiar base de datos");
    } finally {
      setIsPurging(false);
    }
  };

  const handleAddArea = async () => {
    if (!newAreaInput.trim()) return;
    const newList = [...officialAreas, newAreaInput.trim()];
    await setDoc(doc(db, 'metadata', 'areas'), { list: newList });
    setNewAreaInput('');
  };

  const handleRemoveArea = async (areaToRemove) => {
    if (areaToRemove === 'ninguna') return;
    const newList = officialAreas.filter(a => a !== areaToRemove);
    await setDoc(doc(db, 'metadata', 'areas'), { list: newList });
  };

  const formatWhatsApp = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); 
    if (cleaned.length === 10 && (cleaned.startsWith('11') || cleaned.startsWith('15'))) {
      cleaned = '549' + cleaned;
    }
    if (cleaned.startsWith('5411') && cleaned.length === 12) {
      cleaned = '549' + cleaned.slice(2);
    }
    return cleaned;
  };

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
      alert("Error: " + error.message);
    }
  };

  const handleGrantPermission = async (targetUserId, currentVal) => {
    if (dbUser?.role !== 'pastor') return;
    try {
        await updateDoc(doc(db, 'users', targetUserId), { canAddMembers: !currentVal });
        setEditingUser(prev => ({...prev, canAddMembers: !currentVal}));
    } catch (e) { alert("Error"); }
  };

  const handleCreateUser = async () => {
    if (!newUser.displayName.trim()) return alert("El nombre es obligatorio");
    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        ...newUser,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });
      setIsCreating(false);
      setNewUser({ displayName: '', role: 'miembro', area: 'ninguna', phone: '', address: '', needsVisit: false });
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
    <div className="pb-40 bg-slate-50 min-h-screen animate-fade-in p-4 font-outfit text-left overflow-y-auto">
      
      <div className="mb-6 px-2 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Directorio</h1>
          <p className="text-[10px] text-brand-600 uppercase font-black tracking-[0.2em] mt-1">Base de datos unificada ({users.length})</p>
        </div>
        {dbUser?.role === 'pastor' && (
          <button onClick={() => setIsManagingAreas(true)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 active:scale-90 transition-all shadow-sm">
            <Settings size={20}/>
          </button>
        )}
      </div>

      {/* FILTROS MODERNOS */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
        {['Todos', 'Pastor', 'Lider', 'Servidor', 'Miembro'].map(f => (
          <button 
            key={f} onClick={() => setActiveFilter(f)}
            className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 ${activeFilter === f ? 'bg-slate-900 text-white border-slate-900 scale-105' : 'bg-white text-slate-400 border-white'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white p-5 rounded-[28px] shadow-xl shadow-slate-200/50 border-2 border-white mb-8 flex items-center gap-3 sticky top-4 z-30 mx-1">
        <Search className="text-slate-400" size={22}/>
        <input 
          type="text" placeholder="Buscar hermano por nombre..." 
          className="flex-1 outline-none text-slate-700 font-bold bg-transparent placeholder:text-slate-300"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* LISTADO DE USUARIOS */}
      <div className="space-y-8 pb-20">
        {loading && <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-brand-600" size={40}/></div>}
        
        {alphabet.map(letter => (
          <div key={letter}>
            <div className="flex items-center gap-4 mb-4 px-2">
               <span className="text-2xl font-black text-slate-300">{letter}</span>
               <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
            </div>
            <div className="space-y-3">
              {groupedUsers[letter].map(user => (
                <div 
                  key={user.id} 
                  onClick={() => { setEditingUser(user); setSaveStatus('idle'); }}
                  className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex items-center gap-4 active:scale-95 transition-all cursor-pointer relative"
                >
                  <div className="w-14 h-14 min-w-[56px] rounded-2xl overflow-hidden shrink-0 bg-slate-100 border-2 border-white shadow-md">
                    <img 
                       src={user.photoURL || `https://ui-avatars.com/api/?name=${user.finalName}&background=0f172a&color=fff`} 
                       className="w-full h-full object-cover"
                       loading="lazy" referrerPolicy="no-referrer" alt="User"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{user.finalName}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${user.role === 'pastor' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{user.role}</span>
                      {user.area && user.area !== 'ninguna' && <span className="text-[8px] text-brand-600 font-black uppercase tracking-tighter">{user.area}</span>}
                      {user.needsVisit && <span className="text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black uppercase">Visita</span>}
                    </div>
                  </div>
                  <ArrowRightCircle size={20} className="text-slate-100"/>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* GESTOR DE ÁREAS (MODAL EXCLUSIVO PASTOR) */}
      {isManagingAreas && (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-scale-in flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestor de Áreas</h2>
                <button onClick={() => setIsManagingAreas(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
              </div>

              {/* ✅ BOTÓN DE PURGA / LIMPIEZA TOTAL */}
              <button 
                onClick={purgeInvalidAreas}
                disabled={isPurging}
                className="w-full mb-6 p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl flex items-center justify-between text-amber-700 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3 text-left">
                  {isPurging ? <RefreshCw size={24} className="animate-spin" /> : <Eraser size={24}/>}
                  <div>
                    <p className="text-[10px] font-black uppercase">Limpiar Áreas Inválidas</p>
                    <p className="text-[8px] font-bold opacity-60 uppercase mt-0.5">Resetear áreas escritas a mano</p>
                  </div>
                </div>
                <ArrowRightCircle size={20} className="opacity-40" />
              </button>

              <div className="flex gap-2 mb-6">
                 <input 
                    placeholder="Nueva área..." 
                    className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none"
                    value={newAreaInput} onChange={e => setNewAreaInput(e.target.value)}
                 />
                 <button onClick={handleAddArea} className="bg-slate-900 text-white p-3 rounded-xl active:scale-90 transition-all"><Plus size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                  {officialAreas.map(area => (
                    <div key={area} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                       <span className="text-xs font-black uppercase text-slate-700">{area}</span>
                       {area !== 'ninguna' && (
                         <button onClick={() => handleRemoveArea(area)} className="text-rose-500 p-1"><Trash2 size={16}/></button>
                       )}
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {/* BOTÓN REGISTRAR */}
      {canAddPeople && (
        <button 
          onClick={() => setIsCreating(true)}
          className="fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
        >
          <UserPlus size={30} />
        </button>
      )}

      {/* MODAL FICHA TÉCNICA */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-white w-full max-w-sm rounded-[45px] animate-slide-up relative flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            
            <div className="relative h-32 bg-slate-900 shrink-0">
               <button onClick={() => setEditingUser(null)} className="absolute top-6 right-6 p-2.5 bg-white/10 text-white rounded-full active:scale-75"><X size={20}/></button>
               <div className="absolute -bottom-12 left-0 right-0 flex justify-center">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-[35px] overflow-hidden border-4 border-white shadow-2xl bg-white">
                      <img src={editingUser.photoURL || `https://ui-avatars.com/api/?name=${editingUser.finalName}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    {dbUser?.role === 'pastor' && (
                      <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2.5 rounded-2xl cursor-pointer shadow-lg border-2 border-white">
                        {uploading ? <Loader2 size={18} className="animate-spin"/> : <Camera size={18}/>}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                      </label>
                    )}
                  </div>
               </div>
            </div>

            <div className="pt-16 px-8 pb-10 overflow-y-auto no-scrollbar text-center">
              <input 
                disabled={dbUser?.role !== 'pastor'}
                className="text-2xl font-black text-slate-900 text-center w-full bg-transparent outline-none uppercase tracking-tighter"
                value={editingUser.finalName} 
                onChange={(e) => setEditingUser({...editingUser, finalName: e.target.value})}
              />
              <div className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Rango</label>
                    <select disabled={dbUser?.role !== 'pastor'} value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[10px] font-black uppercase outline-none focus:border-brand-200">
                        <option value="pastor">Pastor</option><option value="lider">Líder</option><option value="servidor">Servidor</option><option value="miembro">Miembro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Área</label>
                    {/* ✅ SELECT DE ÁREAS FIJAS SIN TEXTO LIBRE */}
                    <select disabled={dbUser?.role !== 'pastor'} value={editingUser.area?.toLowerCase()} onChange={e => setEditingUser({...editingUser, area: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-[10px] font-black uppercase outline-none">
                        {officialAreas.map(area => <option key={area} value={area.toLowerCase()}>{area}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5"><Phone size={10}/> Teléfono</label>
                  <input disabled={dbUser?.role !== 'pastor'} value={editingUser.phone || ''} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold outline-none" placeholder="Sin número" />
                </div>

                <button 
                    disabled={dbUser?.role !== 'pastor'}
                    onClick={() => setEditingUser({...editingUser, needsVisit: !editingUser.needsVisit})}
                    className={`w-full flex items-center justify-between p-5 rounded-[28px] border-2 transition-all ${editingUser.needsVisit ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-inner' : 'bg-slate-50 border-slate-50 text-slate-400'}`}
                >
                    <div className="flex items-center gap-3 text-left">
                        <Heart size={20} fill={editingUser.needsVisit ? "currentColor" : "none"}/>
                        <span className="text-[10px] font-black uppercase tracking-widest">Desea ser visitado/a</span>
                    </div>
                    {editingUser.needsVisit ? <CheckCircle size={20}/> : <div className="w-5 h-5 rounded-full border-2 border-slate-200"></div>}
                </button>

                {dbUser?.role === 'pastor' && (
                  <div className="pt-8 space-y-4">
                    <button onClick={handleSaveUser} disabled={saveStatus !== 'idle'} className={`w-full font-black py-5 rounded-3xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] shadow-2xl transition-all ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-slate-900 text-white active:scale-95'}`}>
                      {saveStatus === 'idle' ? <><Save size={20}/> Guardar Cambios</> : saveStatus === 'saving' ? <Loader2 size={20} className="animate-spin"/> : "✓ Actualizado"}
                    </button>
                    <button onClick={() => { if(window.confirm(`¿Eliminar?`)) { deleteDoc(doc(db, 'users', editingUser.id)); setEditingUser(null); } }} className="w-full py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 rounded-2xl transition-colors">
                      <Trash2 size={16}/> Baja Definitiva
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR MIEMBRO */}
      {isCreating && (
        <div className="fixed inset-0 z-[120] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left">
          <div className="bg-white w-full max-w-sm rounded-[45px] p-8 animate-scale-in relative shadow-2xl border-t-8 border-slate-900 overflow-y-auto no-scrollbar max-h-[90vh]">
            <button onClick={() => setIsCreating(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter leading-none">Inscripción</h2>
            <div className="space-y-5">
              <input placeholder="Nombre Completo" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none focus:border-brand-500 transition-all" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})}/>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Rol</label>
                  <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="miembro">Miembro</option><option value="servidor">Servidor</option><option value="lider">Líder</option><option value="pastor">Pastor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Área</label>
                  {/* ✅ SIN TEXTO LIBRE */}
                  <select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase" value={newUser.area} onChange={e => setNewUser({...newUser, area: e.target.value})}>
                    {officialAreas.map(area => <option key={area} value={area.toLowerCase()}>{area}</option>)}
                  </select>
                </div>
              </div>
              <input placeholder="WhatsApp" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})}/>
              <button onClick={handleCreateUser} className="w-full bg-slate-900 text-white font-black py-5 rounded-[25px] mt-4 shadow-2xl uppercase text-xs tracking-[0.3em] flex items-center justify-center gap-2 active:scale-95 transition-all">
                <UserCheck size={20}/> Registrar Miembro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}