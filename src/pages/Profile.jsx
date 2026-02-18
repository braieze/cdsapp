import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  User, Phone, MapPin, Calendar, Save, Edit3, Shield, 
  Briefcase, LogOut, Camera, Loader2, MessageCircle, 
  ExternalLink, Heart, AlertCircle, Fingerprint, Download, CreditCard
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

export default function Profile() {
  const currentUser = auth.currentUser;
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCredential, setShowCredential] = useState(false);

  const CLOUD_NAME = "djmkggzjp"; 
  const UPLOAD_PRESET = "ml_default"; 

  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    birthday: '',
    dni: '',
    bloodType: '',
    emergencyName: '',
    emergencyPhone: '',
    ministerio: ''
  });

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
            birthday: data.birthday || '',
            dni: data.dni || '',
            bloodType: data.bloodType || '',
            emergencyName: data.emergencyName || '',
            emergencyPhone: data.emergencyPhone || '',
            ministerio: data.ministerio || data.area || ''
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [currentUser]);

  const handleSave = async () => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { ...formData });
      setUserData({ ...userData, ...formData });
      setIsEditing(false);
    } catch (error) { alert("Error al guardar cambios"); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const fd = new FormData();
      fd.append("file", compressedFile);
      fd.append("upload_preset", UPLOAD_PRESET);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      const data = await response.json();

      if (data.secure_url) {
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: data.secure_url });
        setUserData(prev => ({ ...prev, photoURL: data.secure_url }));
      }
    } catch (error) { console.error(error); } finally { setUploadingPhoto(false); }
  };

  const handleLogout = () => { if(window.confirm("¿Cerrar sesión?")) signOut(auth); };

  // ✅ ACCIONES SMART
  const openMaps = () => {
    if (!userData?.address) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(userData.address)}`, '_blank');
  };

  const openWhatsApp = () => {
    if (!userData?.phone) return;
    const cleanPhone = userData.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-brand-600" /></div>;

  const displayPhoto = userData?.photoURL || currentUser?.photoURL;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen relative animate-fade-in font-outfit">
      
      {/* PORTADA */}
      <div className="relative mb-16">
        <div className="h-40 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 w-full rounded-b-[50px] shadow-2xl"></div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative group">
            <img src={displayPhoto} className={`w-32 h-32 rounded-[40px] border-4 border-white object-cover shadow-2xl bg-white ${uploadingPhoto ? 'opacity-50' : ''}`} />
            <label className="absolute -bottom-2 -right-2 bg-brand-600 text-white p-2.5 rounded-2xl border-4 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
              <Camera size={18} />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto}/>
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-6 mb-8">
        <h1 className="text-2xl font-black text-slate-800 leading-tight">{currentUser?.displayName}</h1>
        <div className="flex justify-center gap-2 mt-3">
          <span className="px-3 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5">
            <Shield size={12} /> {userData?.role || 'Miembro'}
          </span>
          <span className="px-3 py-1 rounded-xl bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-tighter border border-brand-100 flex items-center gap-1.5">
            <Briefcase size={12} /> {formData.ministerio || 'Sin Área'}
          </span>
        </div>
      </div>

      {/* ✅ SECCIÓN DE ACCIÓN RÁPIDA (SOLO VISIBLE SI NO EDITA) */}
      {!isEditing && (
        <div className="px-4 mb-6 grid grid-cols-2 gap-3">
           <button onClick={openWhatsApp} className="bg-emerald-50 text-emerald-700 p-4 rounded-3xl border border-emerald-100 flex flex-col items-center gap-2 active:scale-95 transition-all">
              <MessageCircle size={24}/>
              <span className="text-[10px] font-black uppercase">WhatsApp</span>
           </button>
           <button onClick={openMaps} className="bg-blue-50 text-blue-700 p-4 rounded-3xl border border-blue-100 flex flex-col items-center gap-2 active:scale-95 transition-all">
              <MapPin size={24}/>
              <span className="text-[10px] font-black uppercase">Ubicación</span>
           </button>
           <button onClick={() => setShowCredential(true)} className="col-span-2 bg-slate-900 text-white p-4 rounded-3xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
              <CreditCard size={20}/>
              <span className="text-xs font-black uppercase tracking-widest">Mi Credencial Digital</span>
           </button>
        </div>
      )}

      {/* FORMULARIO PRO */}
      <div className="px-4 space-y-4">
        <div className="bg-white rounded-[35px] shadow-sm border border-slate-100 overflow-hidden p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><User size={16} className="text-brand-600"/> Ficha de Servidor</h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
              {isEditing ? <Save size={20}/> : <Edit3 size={20}/>}
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DNI / ID</label>
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <Fingerprint size={16} className="text-slate-400"/>
                    <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="bg-transparent text-sm font-bold w-full outline-none disabled:text-slate-500" placeholder="00.000.000" />
                  </div>
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grupo Sanguíneo</label>
                  <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <Heart size={16} className="text-rose-500"/>
                    <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({...formData, bloodType: e.target.value})} className="bg-transparent text-sm font-bold w-full outline-none disabled:text-slate-500" placeholder="O+" />
                  </div>
               </div>
            </div>

            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ministerio / Área</label>
               <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                 <Briefcase size={16} className="text-indigo-500"/>
                 <input disabled={!isEditing} value={formData.ministerio} onChange={e => setFormData({...formData, ministerio: e.target.value})} className="bg-transparent text-sm font-bold w-full outline-none" placeholder="Multimedia, Alabanza..." />
               </div>
            </div>

            <div className="bg-rose-50/50 p-4 rounded-3xl border border-rose-100 mt-4">
               <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-3 block">Contacto de Emergencia</label>
               <div className="space-y-3">
                  <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} className="w-full bg-white p-3 rounded-2xl text-xs font-bold border border-rose-100 outline-none" placeholder="Nombre de contacto" />
                  <div className="flex gap-2">
                    <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} className="flex-1 bg-white p-3 rounded-2xl text-xs font-bold border border-rose-100 outline-none" placeholder="Teléfono" />
                    {!isEditing && formData.emergencyPhone && (
                      <a href={`tel:${formData.emergencyPhone}`} className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg"><Phone size={18}/></a>
                    )}
                  </div>
               </div>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest py-5 rounded-[30px] bg-rose-50 border border-rose-100 active:scale-95 transition-all">
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>

      {/* ✅ MODAL CREDENCIAL DIGITAL */}
      {showCredential && (
        <div className="fixed inset-0 z-[500] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowCredential(false)}>
          <div className="w-full max-w-xs space-y-6" onClick={e => e.stopPropagation()}>
             <div className="bg-white rounded-[40px] overflow-hidden shadow-2xl relative">
                <div className="h-24 bg-brand-600 w-full flex items-center justify-center p-6">
                   <h2 className="text-white font-black uppercase tracking-tighter text-xl">Conquistadores</h2>
                </div>
                <div className="p-8 text-center">
                   <img src={displayPhoto} className="w-28 h-28 rounded-[35px] mx-auto -mt-20 border-8 border-white shadow-xl object-cover mb-4" />
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{currentUser?.displayName}</h3>
                   <p className="text-[10px] font-black text-brand-600 uppercase mb-6 tracking-widest">{formData.ministerio || 'SERVIDOR'}</p>
                   
                   <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-100 pt-6">
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">DNI</p><p className="text-xs font-bold text-slate-800">{formData.dni || '-'}</p></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase">Sangre</p><p className="text-xs font-bold text-slate-800">{formData.bloodType || '-'}</p></div>
                   </div>
                   
                   <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                      <div className="w-24 h-24 bg-slate-100 mx-auto rounded-2xl flex items-center justify-center border-2 border-slate-50 opacity-30">
                        <Loader2 className="animate-spin text-slate-400"/>
                      </div>
                      <p className="text-[8px] font-bold text-slate-300 mt-2 uppercase tracking-widest">ID: {currentUser.uid.slice(0,12)}</p>
                   </div>
                </div>
             </div>
             
             <button className="w-full bg-brand-600 text-white py-4 rounded-3xl font-black text-xs uppercase flex items-center justify-center gap-3 shadow-2xl animate-pulse">
                <Download size={18}/> Descargar PDF (PRÓXIMAMENTE)
             </button>
          </div>
        </div>
      )}
    </div>
  );
}