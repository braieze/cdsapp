import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Search, Shield, Briefcase, Camera, Loader2, Save, X, Phone, UserPlus, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function Directory() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estado para editar o crear
  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Estados para nuevo usuario
  const [newUser, setNewUser] = useState({ displayName: '', role: 'miembro', area: 'ninguna', phone: '' });

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  // 1. Cargar Usuarios
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Guardar CAMBIOS (Edición)
  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        role: editingUser.role,
        area: editingUser.area,
        phone: editingUser.phone || ''
      });
      setEditingUser(null);
      alert("Datos actualizados");
    } catch (error) {
      console.error(error);
      alert("Error al actualizar");
    }
  };

  // 3. Crear NUEVO Miembro
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
      alert("¡Miembro agregado con éxito!");
    } catch (error) {
      console.error(error);
      alert("Error al crear miembro");
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
            className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
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
                {user.area !== 'ninguna' && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium capitalize">{user.area}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BOTÓN FLOTANTE: AGREGAR MIEMBRO */}
      <button 
        onClick={() => setIsCreating(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-500/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
      >
        <UserPlus size={28} />
      </button>

      {/* --- MODAL 1: EDICIÓN DE MIEMBRO (CENTRADO Y Z-60) --- */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative max-h-[85vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-3 group">
                <img src={editingUser.photoURL || `https://ui-avatars.com/api/?name=${editingUser.displayName}&background=random`} className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md" />
                <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full cursor-pointer hover:bg-brand-700 shadow-sm active:scale-95">
                  {uploading ? <Loader2 size={16} className="animate-spin"/> : <Camera size={16}/>}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading}/>
                </label>
              </div>
              <h2 className="text-xl font-bold text-slate-800 text-center">{editingUser.displayName}</h2>
              
              <div className="flex items-center gap-2 mt-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-full">
                <Phone size={14} className="text-slate-400"/>
                <input 
                  type="text" 
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  placeholder="Teléfono"
                  className="bg-transparent text-sm w-full outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Shield size={12}/> Rol</label>
                <select value={editingUser.role || 'miembro'} onChange={(e) => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                  <option value="pastor">Pastor</option><option value="lider">Líder</option><option value="servidor">Servidor</option><option value="miembro">Miembro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Briefcase size={12}/> Área</label>
                <select value={editingUser.area || 'ninguna'} onChange={(e) => setEditingUser({...editingUser, area: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                  <option value="ninguna">Ninguna</option><option value="multimedia">Multimedia</option><option value="alabanza">Alabanza</option><option value="recepcion">Recepción</option><option value="niños">Niños</option>
                </select>
              </div>
              <button onClick={handleSaveUser} className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-md hover:bg-brand-700">
                <Save size={18}/> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CREAR NUEVO MIEMBRO (CENTRADO Y Z-60) --- */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 animate-slide-up relative shadow-2xl">
            <button onClick={() => setIsCreating(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            <h2 className="text-lg font-black text-slate-800 mb-4">Nuevo Miembro</h2>
            
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