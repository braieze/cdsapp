import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  User, Save, Edit3, Shield, Briefcase, LogOut, Camera,
  Loader2, CreditCard, X, Download, Phone, Calendar as CalendarIcon, 
  MapPin, Heart, ChevronRight, Settings, Plus, Trash2,
  Lock, ArrowLeft
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const credentialRef = useRef(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCredential, setShowCredential] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Estados para Áreas Dinámicas
  const [officialAreas, setOfficialAreas] = useState(['ninguna']);
  const [isManagingAreas, setIsManagingAreas] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');

  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [formData, setFormData] = useState({
    phone: '', address: '', birthday: '', dni: '',
    bloodType: '', emergencyName: '', emergencyPhone: '', area: 'ninguna'
  });

  // 🛡️ Lógica de Roles
  const userRole = userData?.role || 'miembro';
  const isPastor = userRole === 'pastor';
  const isLider = userRole === 'lider';
  const isStaff = isPastor || isLider;

  // 1. Cargar datos del usuario
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
            area: data.area || 'ninguna'
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [currentUser]);

  // 2. Cargar Áreas Oficiales
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'metadata', 'areas'), (docSnap) => {
      if (docSnap.exists()) {
        setOfficialAreas(docSnap.data().list || ['ninguna']);
      }
    });
    return () => unsub();
  }, []);

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

  const handleLogout = () => {
    if (window.confirm("¿Cerrar sesión en CDS APP?")) {
      signOut(auth).catch((error) => console.error(error));
    }
  };

  const handleSave = async () => {
    try {
      // 🎯 Protegemos el campo area en el envío si no es Staff
      const dataToSave = { ...formData };
      if (!isStaff) {
          dataToSave.area = userData.area || 'ninguna';
      }

      await updateDoc(doc(db, 'users', currentUser.uid), dataToSave);
      setUserData({ ...userData, ...dataToSave });
      setIsEditing(false);
    } catch (e) { console.error(e); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const fd = new FormData();
      fd.append("file", compressedFile); fd.append("upload_preset", UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) {
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: data.secure_url });
        setUserData(prev => ({ ...prev, photoURL: data.secure_url }));
      }
    } catch (e) { console.error(e); } finally { setUploadingPhoto(false); }
  };

  const downloadPDF = async () => {
    if (!credentialRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(credentialRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85.6, 139.7] });
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 139.7);
      pdf.save(`Credencial_CDS_${currentUser.displayName.replace(/\s/g, '_')}.pdf`);
    } catch (error) { console.error(error); } finally { setIsGeneratingPDF(false); }
  };

  if (loading) return <div className="flex flex-col items-center justify-center py-32 opacity-40"><Loader2 className="animate-spin text-blue-600 mb-4" size={40} /></div>;

  const displayPhoto = userData?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}&background=EBF4FF&color=2563EB`;

  return (
    <div className="pb-32 bg-[#F8F9FE] min-h-screen relative animate-fade-in font-sans text-left">

      {/* 🚀 HEADER SOCIALYO STYLE */}
      <div className="relative mb-20 bg-white shadow-sm rounded-b-[40px] border-b border-slate-100">
        <div className="absolute top-6 left-5 z-10">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
        </div>
        
        {isPastor && (
          <div className="absolute top-6 right-5 z-10">
            <button onClick={() => setIsManagingAreas(true)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center active:scale-90 transition-transform">
                <Settings size={20} />
            </button>
          </div>
        )}

        <div className="h-40 w-full relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-b-[40px]"></div>
          <div className="h-full flex flex-col items-center justify-center pb-6">
            <span className="text-blue-600/20 font-black text-6xl tracking-tighter italic">CDS</span>
          </div>
        </div>

        {/* AVATAR ELEVADO */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-32 h-32 rounded-[28px] border-4 border-white overflow-hidden shadow-lg bg-slate-100 flex-shrink-0">
              <img src={displayPhoto} className={`w-full h-full object-cover ${uploadingPhoto ? 'opacity-30' : ''}`} referrerPolicy="no-referrer" alt="Perfil" />
            </div>
            <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-11 h-11 rounded-full border-4 border-white shadow-md flex items-center justify-center cursor-pointer active:scale-90 transition-transform">
              {uploadingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} strokeWidth={2.5}/>}
              <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-6 mb-8 mt-2 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 truncate">{currentUser?.displayName}</h1>
        <div className="flex justify-center flex-wrap gap-2 mt-3">
          <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <Shield size={12} className="text-slate-300" /> {userRole}
          </span>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider border border-blue-100 flex items-center gap-1.5 shadow-sm">
            <Briefcase size={12} /> {formData.area}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 space-y-6 pb-10">
        
        {/* MI CREDENCIAL */}
        {!isEditing && (
          <button onClick={() => setShowCredential(true)} className="w-full bg-white border border-slate-100 p-5 rounded-[24px] flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.03)] active:scale-95 transition-transform">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[16px] flex items-center justify-center"><CreditCard size={24} /></div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-slate-900">Mi Credencial Digital</span>
                  <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">Identificación CDS</span>
                </div>
            </div>
            <ChevronRight className="text-slate-300" />
          </button>
        )}

        {/* DATOS DEL MIEMBRO */}
        <div className="bg-white rounded-[32px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 p-6 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <User size={18} className="text-blue-500" /> Datos Personales
            </h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isEditing ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100 active:scale-90'}`}>
              {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">WhatsApp de Contacto</label>
              <input disabled={!isEditing} type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-[#F8F9FE] p-3.5 rounded-[16px] text-sm font-semibold border border-transparent focus:border-blue-300 outline-none disabled:bg-slate-50 disabled:text-slate-600 transition-colors" placeholder="11..." />
            </div>

            {/* ✅ MINISTERIO / ÁREA BLOQUEADO PARA MIEMBROS */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                 Ministerio / Área {!isStaff && <Lock size={12} className="text-slate-300"/>}
              </label>
              <select 
                  disabled={!isEditing || !isStaff} // 🔒 BLOQUEO MAESTRO
                  value={formData.area} 
                  onChange={e => setFormData({ ...formData, area: e.target.value })} 
                  className={`w-full p-3.5 rounded-[16px] text-sm font-semibold uppercase border border-transparent outline-none transition-colors ${
                     !isStaff || !isEditing
                     ? 'bg-slate-50 text-slate-600 cursor-not-allowed appearance-none' 
                     : 'bg-[#F8F9FE] focus:border-blue-300 text-slate-900'
                  }`}
              >
                  {officialAreas.map(a => <option key={a} value={a.toLowerCase()}>{a}</option>)}
              </select>
              {!isStaff && isEditing && (
                  <p className="text-[9px] font-semibold text-rose-500 ml-1 mt-1">Este campo solo es editable por un líder o pastor</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">DNI</label>
                <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full bg-[#F8F9FE] p-3.5 rounded-[16px] text-sm font-semibold border border-transparent focus:border-blue-300 outline-none disabled:bg-slate-50 disabled:text-slate-600 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Grupo Sanguíneo</label>
                <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({ ...formData, bloodType: e.target.value })} className="w-full bg-[#F8F9FE] p-3.5 rounded-[16px] text-sm font-semibold border border-transparent focus:border-blue-300 outline-none uppercase disabled:bg-slate-50 disabled:text-slate-600 transition-colors" placeholder="--"/>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5"><MapPin size={12}/> Domicilio Actual</label>
              <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-[#F8F9FE] p-3.5 rounded-[16px] text-sm font-semibold border border-transparent focus:border-blue-300 outline-none disabled:bg-slate-50 disabled:text-slate-600 transition-colors" placeholder="Calle y altura..." />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1.5"><CalendarIcon size={12}/> Fecha de Nacimiento</label>
              <input disabled={!isEditing} type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-[#F8F9FE] p-3.5 rounded-[16px] text-sm font-semibold border border-transparent focus:border-blue-300 outline-none disabled:bg-slate-50 disabled:text-slate-600 transition-colors" />
            </div>

            {/* EMERGENCIA (SUAVIZADO) */}
            <div className="bg-rose-50/50 p-5 rounded-[24px] border border-rose-100 mt-2 space-y-3">
              <label className="text-[11px] font-bold text-rose-500 flex items-center gap-1.5 ml-1"><Heart size={14} fill="currentColor"/> En caso de emergencia</label>
              <div className="space-y-2.5">
                <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} className="w-full bg-white p-3.5 rounded-[16px] text-sm font-semibold border border-rose-100 outline-none shadow-sm disabled:text-slate-600" placeholder="Nombre de contacto" />
                <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} className="w-full bg-white p-3.5 rounded-[16px] text-sm font-semibold border border-rose-100 outline-none shadow-sm disabled:text-slate-600" placeholder="Teléfono de contacto" />
              </div>
            </div>
          </div>
        </div>

        {/* LOGOUT */}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 text-red-500 font-bold text-xs uppercase tracking-wider py-4 rounded-full bg-white border border-red-100 active:scale-95 transition-transform shadow-sm">
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>

      {/* 🚀 MODAL GESTOR DE ÁREAS (PASTOR) */}
      {isManagingAreas && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col max-h-[85vh] animate-slide-up">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">Gestor de Áreas</h2>
                <button onClick={() => setIsManagingAreas(false)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-full text-slate-400 active:scale-90"><X size={18}/></button>
              </div>
              <div className="flex gap-2 mb-6">
                 <input placeholder="Nueva área..." className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm outline-none focus:border-blue-500" value={newAreaInput} onChange={e => setNewAreaInput(e.target.value)} />
                 <button onClick={handleAddArea} className="w-12 h-12 bg-blue-600 text-white rounded-xl active:scale-90 transition-transform flex items-center justify-center shadow-md"><Plus size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pb-6">
                  {officialAreas.map(area => (
                    <div key={area} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                       <span className="text-sm font-semibold uppercase text-slate-700">{area}</span>
                       {area !== 'ninguna' && (
                         <button onClick={() => handleRemoveArea(area)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={16}/></button>
                       )}
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {/* 🚀 MODAL CREDENCIAL DIGITAL SOCIALYO STYLE */}
      {showCredential && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
          <button onClick={() => setShowCredential(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform z-[700]">
            <X size={20} />
          </button>

          <div className="w-full flex justify-center items-center py-6 scale-[0.9] sm:scale-100">
            <div ref={credentialRef} className="w-[320px] bg-white rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col animate-scale-in">
                
                {/* Cabecera Credencial */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 pb-12 relative">
                  <div className="absolute top-4 right-5 text-white/20 italic font-black text-4xl">CDS</div>
                  <div className="w-12 h-12 bg-white/10 rounded-[14px] flex items-center justify-center text-white backdrop-blur-md">
                     <Shield size={24}/>
                  </div>
                </div>

                <div className="px-8 pb-10 flex flex-col items-center bg-white flex-1 -mt-10 relative z-10">
                  <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden mb-4 bg-slate-100 flex-shrink-0">
                      <img src={displayPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Foto" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 leading-tight mb-1 text-center">{currentUser?.displayName}</h3>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">{userRole}</p>
                  
                  <div className="w-full grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ID Miembro</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{currentUser.uid.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Área</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate px-1 capitalize">{formData.area}</p>
                      </div>
                  </div>

                  <div className="mt-8 p-4 bg-[#F8F9FE] rounded-[24px] border border-slate-100">
                      <QRCodeCanvas 
                          value={`CDS_APP_VERIFY_${currentUser.uid}`} 
                          size={100} 
                          level="H" 
                          bgColor={"#F8F9FE"} 
                          fgColor={"#0f172a"}
                      />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-4">Pase Oficial Digital</p>
                </div>
            </div>
          </div>

          <button onClick={downloadPDF} disabled={isGeneratingPDF} className="w-full max-w-[320px] bg-blue-600 text-white py-4 rounded-full font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={20} /> : <><Download size={20} /> Guardar Imagen</>}
          </button>
        </div>
      )}
    </div>
  );
}