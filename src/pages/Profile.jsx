import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  User, Save, Edit3, Shield, Briefcase, LogOut, Camera,
  Loader2, CreditCard, X, Download
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    bloodType: '', emergencyName: '', emergencyPhone: '', ministerio: ''
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
            phone: data.phone || '', address: data.address || '',
            birthday: data.birthday || '', dni: data.dni || '',
            bloodType: data.bloodType || '', emergencyName: data.emergencyName || '',
            emergencyPhone: data.emergencyPhone || '', ministerio: data.ministerio || data.area || ''
          });
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [currentUser]);

  const handleLogout = () => {
    if (window.confirm("¿Cerrar sesión de Conquistadores?")) {
      signOut(auth).catch((error) => console.error("Error:", error));
    }
  };

  const downloadPDF = async () => {
    if (!credentialRef.current) return;
    setIsGeneratingPDF(true);
    try {
      // Para el diseño nuevo, necesitamos capturar el elemento con fondo blanco
      const canvas = await html2canvas(credentialRef.current, {
        scale: 4,
        useCORS: true,
        backgroundColor: "#ffffff" // Fondo blanco para la credencial limpia
      });
      const imgData = canvas.toDataURL('image/png');
      // Formato vertical más estándar para credencial
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85.6, 139.7] // Tamaño cercano a CR-80 vertical extendido
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 139.7);
      pdf.save(`Credencial_CDS_${currentUser.displayName.replace(/\s/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error en PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
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

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;

  const displayPhoto = userData?.photoURL || currentUser?.photoURL;
  const userRole = userData?.role || 'Miembro';
  const userMinisterio = formData.ministerio;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen relative animate-fade-in font-outfit">

      {/* PORTADA MÁS LIMPIA */}
      <div className="relative mb-16">
        <div className="h-44 bg-slate-900 w-full rounded-b-[40px] shadow-xl overflow-hidden relative border-b-2 border-brand-500">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="h-full flex flex-col items-center justify-center pb-6">
            <span className="text-white font-black text-4xl tracking-tighter">CDS</span>
            <span className="text-brand-500 font-bold text-[9px] uppercase tracking-[0.3em] mt-1">Conquistadores</span>
          </div>
        </div>

        {/* FOTO DE PERFIL */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden shadow-xl bg-white">
              <img src={displayPhoto} className={`w-full h-full object-cover ${uploadingPhoto ? 'opacity-50' : ''}`} />
            </div>
            <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2.5 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-110 active:scale-90 transition-all">
              <Camera size={16} />
              <input type="file" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-6 mb-8">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{currentUser?.displayName}</h1>
        <div className="flex justify-center gap-2 mt-3">
          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={12} className="text-slate-400" /> {userRole}
          </span>
          {userMinisterio && (
            <span className="px-3 py-1 rounded-lg bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-widest border border-brand-100 flex items-center gap-1.5">
              <Briefcase size={12} className="text-brand-500" /> {userMinisterio}
            </span>
          )}
        </div>
      </div>

      {/* BOTÓN ÚNICO DE CREDENCIAL (YA NO ESTÁN LOS DE WHATSAPP/MAPS) */}
      {!isEditing && (
        <div className="px-6 mb-8">
          <button onClick={() => setShowCredential(true)} className="w-full bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all group relative overflow-hidden">
            <CreditCard size={20} className="text-brand-400" />
            <span className="text-xs font-black uppercase tracking-widest">Ver Credencial Digital</span>
          </button>
        </div>
      )}

      {/* FICHA TÉCNICA (MÁS COMPACTA) */}
      <div className="px-6 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
              <User size={16} className="text-brand-500" /> Mis Datos
            </h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-2.5 rounded-xl transition-all ${isEditing ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
              {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">DNI</label>
                <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-brand-500 outline-none disabled:text-slate-600 transition-all" placeholder="Ingrese DNI" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Sangre</label>
                <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({ ...formData, bloodType: e.target.value })} className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-brand-500 outline-none uppercase disabled:text-slate-600 transition-all text-center" placeholder="O+" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Dirección</label>
              <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 p-3 rounded-xl text-sm font-bold border border-transparent focus:border-brand-500 outline-none disabled:text-slate-600 transition-all" placeholder="Calle y altura..." />
            </div>

            {(isEditing || (formData.emergencyName || formData.emergencyPhone)) && (
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <label className="text-[9px] font-bold text-rose-500 uppercase mb-3 block">Emergencia</label>
                <div className="space-y-2">
                  <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} className="w-full bg-white p-3 rounded-xl text-xs font-bold border border-rose-200 outline-none placeholder:text-rose-300" placeholder="Nombre contacto" />
                  <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} className="w-full bg-white p-3 rounded-xl text-xs font-bold border border-rose-200 outline-none placeholder:text-rose-300" placeholder="Teléfono contacto" />
                </div>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-rose-500 font-bold text-[10px] uppercase tracking-wider py-4 rounded-2xl bg-rose-50 border border-rose-100 active:scale-95 transition-all mt-4">
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>

      {/* NUEVA CREDENCIAL LIMPIA (Diseño basado en referencia) */}
      {showCredential && (
        <div className="fixed inset-0 z-[500] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <button onClick={() => setShowCredential(false)} className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={24} /></button>

          {/* CONTENEDOR DEL CARNET PARA PDF */}
          <div ref={credentialRef} className="w-full max-w-[320px] bg-white rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
            {/* Cuerpo Blanco */}
            <div className="p-8 pb-10 flex flex-col items-center text-center bg-white flex-1">
              {/* Foto Circular Grande */}
              <div className="w-36 h-36 rounded-full border-4 border-slate-100 shadow-sm overflow-hidden mb-4">
                <img src={displayPhoto} className="w-full h-full object-cover" />
              </div>

              {/* Nombre y Rol */}
              <h3 className="text-2xl font-black text-slate-800 uppercase leading-tight mb-1">
                {currentUser?.displayName?.split(' ').slice(0, 2).join(' ')}
              </h3>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{userRole}</p>
              
              {/* Área (Condicional) */}
              {userMinisterio && (
                <span className="px-3 py-0.5 bg-brand-50 text-brand-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-100 inline-block mt-1">
                  {userMinisterio}
                </span>
              )}

              {/* Datos Extras */}
              <div className="grid grid-cols-2 gap-4 w-full mt-8 pt-6 border-t border-slate-100">
                <div className="text-center">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID MIEMBRO</p>
                   <p className="text-xs font-black text-slate-800 mt-0.5">{currentUser.uid.slice(0, 6).toUpperCase()}</p>
                </div>
                <div className="text-center">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">DNI</p>
                   <p className="text-xs font-black text-slate-800 mt-0.5">{formData.dni || '-'}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-8">
                <QRCodeCanvas value={`https://cds-app.com/verify/${currentUser.uid}`} size={80} level="M" bgColor={"#ffffff"} fgColor={"#0f172a"}/>
              </div>
            </div>

            {/* Footer Azul */}
            <div className="h-16 bg-slate-900 w-full flex items-center justify-between px-6">
               <div>
                 <span className="text-white font-black text-xl tracking-tighter">CDS</span>
               </div>
               <Shield size={24} className="text-brand-500 opacity-50"/>
            </div>
          </div>

          <button
            onClick={downloadPDF}
            disabled={isGeneratingPDF}
            className="w-full max-w-[320px] bg-brand-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-70 mt-6"
          >
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={18} /> : <><Download size={18} /> Descargar Credencial PDF</>}
          </button>
        </div>
      )}
    </div>
  );
}