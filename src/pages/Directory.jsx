import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { Search, Shield, Briefcase, Camera, Loader2, Save, X, Phone, UserPlus, MapPin, Calendar as CalendarIcon, Mail } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function Directory() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estado para el modal de edición/visualización
  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Nuevo Usuario (Manual)
  const [newUser, setNewUser] = useState({ displayName: '', role: 'miembro', area: 'ninguna', phone: '' });

  // Configuración de Cloudinary
  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // 1. Cargar Usuarios
  useEffect(() => {
    // A. Escuchar la lista de usuarios
    const q = query(collection(db, 'users'), orderBy('displayName'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    });

    // B. Verificación de seguridad: Asegurar que YO (el pastor) estoy en la lista
    const checkMyself = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const myRef = doc(db, 'users', currentUser.uid);
        const mySnap = await getDoc(myRef);
        if (!mySnap.exists()) {
          // Si no existo, me creo ahora mismo
          await setDoc(myRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'pastor', 
            area: 'ninguna',
            createdAt: serverTimestamp()
          });
        }
      }
    };
    checkMyself();

    return () => unsubscribe();
  }, []);

  // 2. Guardar TODOS los datos (Rol, Área, Teléfono, Dirección, Cumple)
  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        displayName: editingUser.displayName,
        role: editingUser.role,
        area: editingUser.area,
        phone: editingUser.phone || '',
        address: editingUser.address || '',
        birthday: editingUser.birthday || '', // Formato YYYY-MM-DD
      });
      setEditingUser(null);
      alert("✅ Datos actualizados correctamente");
    } catch (error) {
      console.error(error);
      alert("Error al actualizar");
    }
  };

  // 3. Crear Usuario Manualmente
  const handleCreateUser = async () => {
    if (!newUser.displayName.trim()) return alert("El nombre es obligatorio");
    try {
      await addDoc(collection(db, 'users'), {
        ...newUser,
        email: 'registrado_manualmente', 
        photoURL: null,
        createdAt: serverTimestamp()
      });
      setIsCreating(false);
      setNewUser({ displayName: '', role: 'miembro', area: 'ninguna', phone: '' });
      alert("Miembro agregado");
    } catch (error) {
      console.error(error);
    }
  };

  // 4. Subir Foto
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
        await updateDoc(userRef, { photoURL: data.secure_url });
        setEditingUser({ ...editingUser, photoURL: data.secure_url });
      }
    } catch (error) {
      console.error(error);
      alert("Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pb-24 bg-slate-50 min-h-screen animate-fade-in p-4 relative">
      
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 mb-1">Directorio</h1>
        <p className="text-sm text-slate-500">Gestión de miembros ({users.length})</p>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-4 flex items-center gap-2 sticky top-4 z-10">
        <Search className="text-slate-400" size={20}/>
        <input 
          type="text" 
          placeholder="Buscar miembro..." 
          className="flex-1 outline-none text-slate-700 placeholder:text-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {loading && <div className="text-center py-10">Cargando...</div>}
        
        {filteredUsers.map(user => (
          <div 
            key={user.id} 
            onClick={() => setEditingUser(user)}
            className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors active:scale-95"
          >
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} 
              className="w-12 h-12 rounded-full object-cover border border-slate-100"
              alt={user.displayName}
            />
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm">{user.displayName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md font-bold uppercase">{user.role}</span>
                {user.area !== 'ninguna' && user.area && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium capitalize">{user.area}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BOTÓN FLOTANTE: AGREGAR */}
      <button 
        onClick={() => setIsCreating(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-500/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
      >
        <UserPlus size={28} />
      </button>

      {/* --- MODAL DE FICHA COMPLETA (EDICIÓN) --- */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl animate-slide-up relative flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            
            {/* Cabecera del Modal con Foto */}
            <div className="relative h-32 bg-gradient-to-r from-brand-600 to-purple-600 rounded-t-2xl flex-shrink-0">
               <button onClick={() => setEditingUser(null)} className="absolute top-3 right-3 p-2 bg-black/20 text-white hover:bg-black/40 rounded-full backdrop-blur-sm z-10"><X size={20}/></button>
               <div className="absolute -bottom-10 left-0 right-0 flex justify-center">
                  <div className="relative group">
                    <img src={editingUser.photoURL || `https://ui-avatars.com/api/?name=${editingUser.displayName}&background=random`} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-white" />
                    <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full cursor-pointer hover:bg-brand-700 shadow-sm active:scale-95 border-2 border-white">
                      {uploading ? <Loader2 size={14} className="animate-spin"/> : <Camera size={14}/>}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                    </label>
                  </div>
               </div>
            </div>

            {/* Cuerpo del Modal (Scrollable) */}
            <div className="pt-12 px-5 pb-5 overflow-y-auto">
              
              {/* Nombre Editable */}
              <div className="text-center mb-6">
                <input 
                  type="text" 
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                  className="text-xl font-black text-slate-800 text-center w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none pb-1"
                />
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><Mail size={10}/> {editingUser.email}</p>
              </div>

              <div className="space-y-4">
                
                {/* 1. Rol y Área (Fila) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Rol</label>
                    <div className="relative">
                      <Shield size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                      <select 
                        value={editingUser.role || 'miembro'} 
                        onChange={(e) => setEditingUser({...editingUser, role: e.target.value})} 
                        className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500"
                      >
                        <option value="pastor">Pastor</option>
                        <option value="lider">Líder</option>
                        <option value="servidor">Servidor</option>
                        <option value="miembro">Miembro</option>
                        <option value="visita">Visita</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Área</label>
                    <div className="relative">
                      <Briefcase size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                      <select 
                        value={editingUser.area || 'ninguna'} 
                        onChange={(e) => setEditingUser({...editingUser, area: e.target.value})} 
                        className="w-full pl-8 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500"
                      >
                        <option value="ninguna">Ninguna</option>
                        <option value="multimedia">Multimedia</option>
                        <option value="alabanza">Alabanza</option>
                        <option value="recepcion">Recepción</option>
                        <option value="niños">Niños</option>
                        <option value="limpieza">Limpieza</option>
                        <option value="intercesion">Intercesión</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Teléfono */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Teléfono / WhatsApp</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-3 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Ej: 11 1234 5678"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                      className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>

                {/* 3. Dirección */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dirección</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Ej: Calle 123, Berazategui"
                      value={editingUser.address || ''}
                      onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                      className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                </div>

                {/* 4. Fecha de Cumpleaños */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Fecha de Nacimiento</label>
                  <div className="relative">
                    <CalendarIcon size={16} className="absolute left-3 top-3 text-slate-400"/>
                    <input 
                      type="date" 
                      value={editingUser.birthday || ''}
                      onChange={(e) => setEditingUser({...editingUser, birthday: e.target.value})}
                      className="w-full pl-10 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 font-medium text-slate-600"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveUser}
                  className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-6 shadow-md shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all"
                >
                  <Save size={18}/> Guardar Ficha
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CREAR NUEVO (MANUAL) --- */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl">
            <button onClick={() => setIsCreating(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><UserPlus size={20} className="text-brand-600"/> Nuevo Miembro</h2>
            
            <div className="space-y-3">
              <input 
                autoFocus
                type="text" 
                placeholder="Nombre Completo" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 font-bold"
                value={newUser.displayName}
                onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="miembro">Miembro</option><option value="servidor">Servidor</option><option value="lider">Líder</option><option value="pastor">Pastor</option>
                </select>
                <select 
                  className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={newUser.area}
                  onChange={(e) => setNewUser({...newUser, area: e.target.value})}
                >
                  <option value="ninguna">Sin Área</option><option value="multimedia">Multimedia</option><option value="alabanza">Alabanza</option><option value="recepcion">Recepción</option><option value="niños">Niños</option>
                </select>
              </div>

              <button onClick={handleCreateUser} className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl mt-2 shadow-md hover:bg-brand-700">
                Agregar Persona
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}