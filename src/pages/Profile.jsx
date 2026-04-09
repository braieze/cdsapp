import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  User, Save, Edit3, Shield, Briefcase, LogOut, Camera,
  Loader2, CreditCard, X, Download, Phone, Calendar as CalendarIcon, MapPin, Heart
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 🛠️ PUNTO 7: ÁREAS OFICIALES (Sincronizado con Directorio)
const AREAS_OFICIALES = [
  'ninguna', 'Bienvenida / Puerta', 'Pasillo / Acomodadores', 'Seguridad Autos', 
  'Control Baños', 'Ministración Altar', 'Alabanza', 'Sonido', 'Multimedia', 
  'Niños', 'Recepción', 'Limpieza', 'Intercesión', 'Predicación'
];

export default function Profile() {
  const currentUser = auth.currentUser;
  const credentialRef = useRef(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCredential, setShowCredential] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [formData, setFormData] = useState({
    phone: '', address: '', birthday: '', dni: '',
    bloodType: '', emergencyName: '', emergencyPhone: '', area: 'ninguna'
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
            area: data.area || 'ninguna'
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [currentUser]);

  const handleLogout = () => {
    if (window.confirm("¿Cerrar sesión en CDS APP?")) {
      signOut(auth).catch((error) => console.error("Error:", error));
    }
  };

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { ...formData });
      setUserData({ ...userData, ...formData });
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

  if (loading) return <div className="flex flex-col items-center justify-center py-32 opacity-20"><Loader2 className="animate-spin text-slate-900 mb-4" size={48} /></div>;

  const displayPhoto = userData?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}&background=0f172a&color=fff`;
  const userRole = userData?.role || 'Miembro';

  return (
    <div className="pb-32 bg-slate-50 min-h-screen relative animate-fade-in font-outfit text-left">

      {/* HEADER PERFIL (Punto 8: Fix Imágenes) */}
      <div className="relative mb-20">
        <div className="h-48 bg-slate-900 w-full rounded-b-[50px] shadow-2xl overflow-hidden relative border-b-4 border-brand-500/30">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]"></div>
          <div className="h-full flex flex-col items-center justify-center pb-8">
            <span className="text-white font-black text-5xl tracking-tighter">CDS</span>
            <span className="text-brand-400 font-black text-[10px] uppercase tracking-[0.4em] mt-2">Identidad Digital</span>
          </div>
        </div>

        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-36 h-36 rounded-[40px] border-4 border-white overflow-hidden shadow-2xl bg-white flex-shrink-0">
              <img 
                src={displayPhoto} 
                className={`w-full h-full object-cover ${uploadingPhoto ? 'opacity-30 animate-pulse' : ''}`} 
                referrerPolicy="no-referrer"
                alt="Avatar"
              />
            </div>
            <label className="absolute bottom-1 right-1 bg-brand-600 text-white p-3 rounded-2xl border-4 border-white shadow-xl cursor-pointer active:scale-75 transition-all">
              {uploadingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-8 mb-10 mt-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{currentUser?.displayName}</h1>
        <div className="flex justify-center gap-3 mt-4">
          <span className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200">
            <Shield size={12} className="text-brand-400" /> {userRole}
          </span>
          <span className="px-4 py-1.5 rounded-xl bg-white text-brand-600 text-[9px] font-black uppercase tracking-widest border-2 border-brand-50 flex items-center gap-2 shadow-sm">
            <Briefcase size={12} /> {formData.area}
          </span>
        </div>
      </div>

      {!isEditing && (
        <div className="px-6 mb-10">
          <button onClick={() => setShowCredential(true)} className="w-full bg-white border-2 border-slate-100 text-slate-900 p-5 rounded-[28px] flex items-center justify-between gap-3 shadow-xl shadow-slate-200/50 active:scale-95 transition-all">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 text-white rounded-2xl"><CreditCard size={20} /></div>
                <span className="text-xs font-black uppercase tracking-widest">Mi Credencial Digital</span>
            </div>
            <ChevronRight className="text-slate-300" />
          </button>
        </div>
      )}

      <div className="px-6 space-y-8 pb-10">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-8 relative">
          <div className="flex justify-between items-center mb-8 border-b pb-4 border-slate-50">
            <h3 className="font-black text-slate-900 uppercase text-sm tracking-tighter flex items-center gap-2">
              <User size={18} className="text-brand-600" /> Datos Personales
            </h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-emerald-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400 active:scale-75'}`}>
              {isEditing ? <Save size={20} /> : <Edit3 size={20} />}
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest">WhatsApp</label>
                <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input disabled={!isEditing} type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 p-4 pl-12 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" placeholder="11..." />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest">Área / Ministerio</label>
                {/* ✅ PUNTO 7: SELECT DE ÁREA FIJA */}
                <select 
                    disabled={!isEditing} 
                    value={formData.area} 
                    onChange={e => setFormData({ ...formData, area: e.target.value })} 
                    className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-black uppercase border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all"
                >
                    {AREAS_OFICIALES.map(a => <option key={a} value={a.toLowerCase()}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest">DNI</label>
                <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" placeholder="ID" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest">G. Sangre</label>
                <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({ ...formData, bloodType: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-black border-2 border-transparent focus:border-brand-500 outline-none uppercase disabled:text-slate-500 transition-all text-center" placeholder="O+" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest flex items-center gap-2"><MapPin size={10}/> Dirección Particular</label>
              <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" placeholder="Calle y altura..." />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-3 tracking-widest flex items-center gap-2"><CalendarIcon size={10}/> Fecha de Nacimiento</label>
              <input disabled={!isEditing} type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all uppercase" />
            </div>

            {/* DATOS DE EMERGENCIA */}
            {(isEditing || (formData.emergencyName || formData.emergencyPhone)) && (
              <div className="bg-rose-50/50 p-6 rounded-[30px] border-2 border-rose-50 space-y-4">
                <label className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2 tracking-widest ml-1"><Heart size={14} fill="currentColor"/> Contacto de Emergencia</label>
                <div className="space-y-3">
                  <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100 outline-none shadow-sm placeholder:text-rose-200" placeholder="Nombre completo" />
                  <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100 outline-none shadow-sm placeholder:text-rose-200" placeholder="Teléfono" />
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 text-rose-600 font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-[28px] bg-rose-50/50 border-2 border-rose-100 active:scale-95 transition-all shadow-xl shadow-rose-100/50">
          <LogOut size={20} /> Salir de la App
        </button>
      </div>

      {/* MODAL CREDENCIAL DIGITAL (PREMIUM) */}
      {showCredential && (
        <div className="fixed inset-0 z-[600] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
          <button onClick={() => setShowCredential(false)} className="absolute top-10 right-10 text-white p-3 bg-white/10 rounded-full active:scale-75 transition-all border border-white/20"><X size={28} /></button>

          <div ref={credentialRef} className="w-full max-w-[340px] bg-white rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col animate-scale-in">
            <div className="p-10 pb-12 flex flex-col items-center text-center bg-white flex-1">
              <div className="w-40 h-40 rounded-[45px] border-8 border-slate-50 shadow-inner overflow-hidden mb-6 bg-slate-50">
                <img src={displayPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{currentUser?.displayName}</h3>
              <p className="text-sm font-black text-brand-600 uppercase tracking-[0.2em] mb-3">{userRole}</p>
              <div className="h-[1px] w-20 bg-slate-100 mb-4"></div>
              
              <div className="grid grid-cols-2 gap-6 w-full mt-4">
                <div className="text-center">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID Miembro</p>
                   <p className="text-xs font-black text-slate-800 mt-1">{currentUser.uid.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-center">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Area</p>
                   <p className="text-xs font-black text-slate-800 mt-1 uppercase">{formData.area}</p>
                </div>
              </div>

              <div className="mt-10 p-4 bg-slate-50 rounded-[30px] border-2 border-slate-50">
                <QRCodeCanvas value={`CDS_APP_VERIFY_${currentUser.uid}`} size={90} level="H" bgColor={"#f8fafc"} fgColor={"#0f172a"}/>
              </div>
            </div>

            <div className="h-20 bg-slate-900 w-full flex items-center justify-between px-10 border-t-4 border-brand-500">
              <span className="text-white font-black text-2xl tracking-tighter italic">CDS</span>
              <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
                <Shield size={22} className="text-brand-500"/>
              </div>
            </div>
          </div>

          <button onClick={downloadPDF} disabled={isGeneratingPDF} className="w-full max-w-[340px] bg-brand-600 text-white py-5 rounded-[28px] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl mt-10 active:scale-95 transition-all">
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={22} /> : <><Download size={22} /> Guardar Credencial</>}
          </button>
        </div>
      )}
    </div>
  );
}

import { ChevronRight } from 'lucide-react';