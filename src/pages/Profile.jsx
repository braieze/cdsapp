import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User, Phone, MapPin, Calendar, Save, Edit3, Shield, Briefcase, LogOut, Camera, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression'; // Importamos el compresor

export default function Profile() {
  const currentUser = auth.currentUser;
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estado para la subida de foto
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // TUS DATOS DE CLOUDINARY (Los mismos de antes)
  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    birthday: ''
  });

  // 1. Cargar datos
  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setFormData({
            phone: data.phone || '',
            address: data.address || '',
            birthday: data.birthday || ''
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [currentUser]);

  // 2. Guardar datos de texto
  const handleSave = async () => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        phone: formData.phone,
        address: formData.address,
        birthday: formData.birthday
      });
      setUserData({ ...userData, ...formData });
      setIsEditing(false);
      alert('Perfil actualizado correctamente');
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar cambios");
    }
  };

  // 3. NUEVO: Subir Foto de Perfil (Del Book)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);

    try {
      // A) Comprimir imagen (Importante para que cargue rápido el perfil)
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      // B) Subir a Cloudinary
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await response.json();

      if (data.secure_url) {
        // C) Guardar URL en Firestore (Sobreescribe la de Google visualmente)
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { photoURL: data.secure_url });
        
        // Actualizar vista local
        setUserData(prev => ({ ...prev, photoURL: data.secure_url }));
        alert("¡Foto de perfil actualizada!");
      }

    } catch (error) {
      console.error("Error subiendo foto:", error);
      alert("Error al subir la foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    if(confirm("¿Cerrar sesión?")) signOut(auth);
  };

  if (loading) return <div className="flex justify-center pt-20"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div></div>;

  // Lógica: Usamos la foto de Firestore si existe, sino la de Google
  const displayPhoto = userData?.photoURL || currentUser?.photoURL;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen relative animate-fade-in">
      
      {/* --- PORTADA Y FOTO --- */}
      <div className="relative mb-16">
        <div className="h-32 bg-gradient-to-r from-brand-600 to-indigo-600 w-full rounded-b-[40px] shadow-lg"></div>
        
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative group">
            {/* FOTO CIRCULAR */}
            <img 
              src={displayPhoto} 
              alt="Perfil" 
              className={`w-24 h-24 rounded-full border-4 border-slate-50 object-cover shadow-xl bg-white ${uploadingPhoto ? 'opacity-50' : ''}`}
            />
            
            {/* SPINNER SI ESTÁ SUBIENDO */}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={24} className="text-brand-600 animate-spin" />
              </div>
            )}

            {/* BOTÓN CÁMARA (INPUT OCULTO) */}
            <label className="absolute bottom-0 right-0 bg-slate-800 text-white p-2 rounded-full border-2 border-white shadow-sm cursor-pointer hover:bg-slate-700 transition-colors hover:scale-110 active:scale-95">
              <Camera size={14} />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto}/>
            </label>
          </div>
        </div>
      </div>

      {/* --- DATOS PRINCIPALES --- */}
      <div className="text-center px-4 mb-6">
        <h1 className="text-2xl font-black text-slate-800">{currentUser?.displayName}</h1>
        <p className="text-sm text-slate-500 font-medium mb-3">{currentUser?.email}</p>
        
        <div className="flex justify-center gap-2">
          <span className="px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-brand-200">
            <Shield size={12} /> {userData?.role || 'Miembro'}
          </span>
          {userData?.area && (
            <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-indigo-200">
              <Briefcase size={12} /> {userData?.area}
            </span>
          )}
        </div>
      </div>

      {/* --- TARJETA DE INFORMACIÓN --- */}
      <div className="px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <User size={18} className="text-brand-600"/> Información Personal
            </h3>
            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                isEditing ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isEditing ? <><Save size={14}/> Guardar</> : <><Edit3 size={14}/> Editar</>}
            </button>
          </div>

          <div className="p-4 space-y-4">
            
            {/* Teléfono */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Teléfono / WhatsApp</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><Phone size={16}/></div>
                {isEditing ? (
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 outline-none"
                    placeholder="+54 11..."
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">{userData?.phone || 'Sin registrar'}</span>
                )}
              </div>
            </div>

            {/* Fecha de Nacimiento */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Fecha de Nacimiento</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center"><Calendar size={16}/></div>
                {isEditing ? (
                  <input 
                    type="date" 
                    value={formData.birthday}
                    onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 outline-none"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">{userData?.birthday || 'Sin registrar'}</span>
                )}
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Dirección</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><MapPin size={16}/></div>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:border-brand-500 outline-none"
                    placeholder="Calle 123..."
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">{userData?.address || 'Sin registrar'}</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Botón Cerrar Sesión */}
        <button 
          onClick={handleLogout}
          className="w-full mt-6 flex items-center justify-center gap-2 text-red-500 font-bold text-sm py-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} /> Cerrar Sesión
        </button>

        <p className="text-center text-[10px] text-slate-300 mt-6 uppercase tracking-widest font-bold">
          ID: {currentUser?.uid.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
}