import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  User, Phone, MapPin, Calendar, Save, Edit3, Shield, 
  Briefcase, LogOut, Camera, Loader2, MessageCircle, 
  Heart, Fingerprint, Download, CreditCard, X, QrCode, Award
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import imageCompression from 'browser-image-compression';
import { QRCodeCanvas } from 'qrcode.react'; // ✅ QR para asistencias

// LIBRERÍAS DE PDF
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
      const canvas = await html2canvas(credentialRef.current, {
        scale: 4, 
        useCORS: true, 
        backgroundColor: "#0f172a"
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 4, canvas.height / 4]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 4, canvas.height / 4);
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

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;

  const displayPhoto = userData?.photoURL || currentUser?.photoURL;

  return (
    <div className="pb-24 bg-slate-50 min-h-screen relative animate-fade-in font-outfit">
      
      {/* PORTADA CON DISEÑO Y LOGO */}
      <div className="relative mb-20">
        <div className="h-52 bg-slate-900 w-full rounded-b-[60px] shadow-2xl overflow-hidden relative border-b-4 border-brand-500">
           {/* Patrón de fondo abstracto */}
           <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
           <div className="h-full flex flex-col items-center justify-center pb-10">
              <span className="text-brand-500 font-black text-6xl tracking-tighter opacity-40">CDS</span>
              <span className="text-white/20 font-bold text-[10px] uppercase tracking-[0.4em] mt-1">Conquistadores de Sueños</span>
           </div>
        </div>
        
        {/* FOTO DE PERFIL (POSICIONADA CORRECTAMENTE ARRIBA) */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div className="relative group">
            <div className="w-36 h-36 rounded-[45px] border-[6px] border-slate-50 overflow-hidden shadow-2xl bg-white">
               <img src={displayPhoto} className={`w-full h-full object-cover ${uploadingPhoto ? 'opacity-50' : ''}`} />
            </div>
            <label className="absolute bottom-1 right-1 bg-brand-600 text-white p-3 rounded-2xl border-4 border-slate-50 shadow-lg cursor-pointer hover:scale-110 active:scale-90 transition-all">
              <Camera size={20} />
              <input type="file" className="hidden" onChange={handlePhotoUpload}/>
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-6 mb-10">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">{currentUser?.displayName}</h1>
        <div className="flex justify-center gap-3 mt-4">
          <span className="px-4 py-1.5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"><Shield size={12} className="text-brand-400"/> {userData?.role || 'Miembro'}</span>
          <span className="px-4 py-1.5 rounded-2xl bg-white text-slate-800 text-[10px] font-black uppercase tracking-widest border-2 border-slate-100 flex items-center gap-2 shadow-sm"><Briefcase size={12} className="text-brand-600"/> {formData.ministerio || 'EQUIPO'}</span>
        </div>
      </div>

      {/* QUICK ACTIONS MEJORADOS */}
      {!isEditing && (
        <div className="px-6 mb-10 grid grid-cols-2 gap-4">
           <a href={`https://wa.me/${formData.phone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="bg-white p-5 rounded-[35px] border-2 border-emerald-50 flex flex-col items-center gap-3 active:scale-95 transition-all shadow-xl shadow-emerald-900/5">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200"><MessageCircle size={24}/></div>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">WhatsApp</span>
           </a>
           <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address || '')}`} target="_blank" rel="noreferrer" className="bg-white p-5 rounded-[35px] border-2 border-blue-50 flex flex-col items-center gap-3 active:scale-95 transition-all shadow-xl shadow-blue-900/5">
              <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-200"><MapPin size={24}/></div>
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Ubicación</span>
           </a>
           <button onClick={() => setShowCredential(true)} className="col-span-2 bg-slate-900 text-white p-6 rounded-[40px] flex items-center justify-between gap-3 shadow-2xl active:scale-95 transition-all group overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:rotate-12 transition-transform"><Award size={80}/></div>
              <div className="flex items-center gap-4 relative z-10">
                 <div className="p-3 bg-brand-500 rounded-2xl shadow-lg"><CreditCard size={24} /></div>
                 <div className="text-left"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identidad Digital</p><p className="text-sm font-black uppercase">VER CREDENCIAL CDS</p></div>
              </div>
              <QrCode size={32} className="text-brand-500 relative z-10"/>
           </button>
        </div>
      )}

      {/* FICHA TÉCNICA (CON BRILLO) */}
      <div className="px-6 space-y-6">
        <div className="bg-white rounded-[45px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
          
          <div className="flex justify-between items-center mb-10 relative z-10">
            <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] flex items-center gap-3">DATOS DE SERVIDOR</h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-4 rounded-[20px] transition-all shadow-lg ${isEditing ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white shadow-slate-200'}`}>
              {isEditing ? <Save size={20}/> : <Edit3 size={20}/>}
            </button>
          </div>

          <div className="space-y-8 relative z-10">
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Nº DOCUMENTO</label>
                  <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl text-sm font-black border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-600 transition-all" placeholder="00.000.000" />
               </div>
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">G. SANGRE</label>
                  <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({...formData, bloodType: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl text-sm font-black border-2 border-transparent focus:border-brand-500 outline-none uppercase disabled:text-slate-600 transition-all text-center" placeholder="O+" />
               </div>
            </div>
            
            <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">DOMICILIO ACTUAL</label>
               <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl text-sm font-black border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-600 transition-all" placeholder="Calle y altura..." />
            </div>

            <div className="bg-slate-900 p-6 rounded-[35px] shadow-xl">
               <label className="text-[9px] font-black text-brand-400 uppercase tracking-[0.2em] mb-5 block border-b border-white/10 pb-2">CONTACTO DE EMERGENCIA</label>
               <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} className="w-full bg-white/5 p-4 rounded-2xl text-xs font-bold text-white border border-white/10 outline-none mb-3 focus:border-brand-500" placeholder="Nombre completo" />
               <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} className="w-full bg-white/5 p-4 rounded-2xl text-xs font-bold text-white border border-white/10 outline-none focus:border-brand-500" placeholder="Teléfono de contacto" />
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 text-rose-500 font-black text-[10px] uppercase tracking-[0.3em] py-6 rounded-[40px] bg-rose-50 border-2 border-rose-100 active:scale-95 transition-all mt-6 shadow-sm mb-10">
          <LogOut size={18} /> CERRAR SESIÓN SEGURA
        </button>
      </div>

      {/* ✅ NUEVA CREDENCIAL CDS (REDiseñada para PDF) */}
      {showCredential && (
        <div className="fixed inset-0 z-[500] bg-slate-950 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
          
          <button onClick={() => setShowCredential(false)} className="absolute top-8 right-8 text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X size={28}/></button>

          {/* EL CARNET (FONDO NEGRO / DISEÑO CUADRADO PARA PDF) */}
          <div ref={credentialRef} className="w-full max-w-[340px] bg-slate-900 shadow-2xl relative border-4 border-brand-500">
            {/* Header Credencial */}
            <div className="h-32 bg-slate-900 w-full flex flex-col items-center justify-center p-6 border-b-2 border-brand-500/30">
               <div className="absolute top-0 right-0 p-4 opacity-5"><Shield size={100} className="text-white"/></div>
               <h2 className="text-brand-500 font-black uppercase tracking-tighter text-3xl">CDS</h2>
               <p className="text-white/40 text-[8px] font-black tracking-[0.5em] uppercase">Conquistadores</p>
            </div>

            <div className="p-10 text-center bg-slate-900">
               {/* Foto integrada en el diseño */}
               <div className="w-40 h-40 mx-auto -mt-24 border-[6px] border-brand-500 bg-slate-800 shadow-2xl overflow-hidden">
                  <img src={displayPhoto} className="w-full h-full object-cover" />
               </div>

               <div className="mt-8">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{currentUser?.displayName}</h3>
                  <div className="inline-block px-4 py-1 bg-brand-500 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-sm mb-8">{formData.ministerio || 'EQUIPO CDS'}</div>
               </div>
               
               <div className="grid grid-cols-2 gap-8 text-left border-t border-white/10 pt-8 mb-10">
                  <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">IDENTIDAD / DNI</p><p className="text-sm font-black text-white">{formData.dni || '-'}</p></div>
                  <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">RANGO / ROL</p><p className="text-sm font-black text-white uppercase">{userData?.role || 'Miembro'}</p></div>
               </div>
               
               {/* ZONA QR TÁCTICA */}
               <div className="pt-8 border-t-2 border-dashed border-brand-500/20 flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-none shadow-inner">
                    <QRCodeCanvas value={`https://mceh.app/verify/${currentUser.uid}`} size={100} level="H" />
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-brand-500 uppercase tracking-[0.4em]">Verified Server</p>
                    <p className="text-[7px] text-white/20 font-mono mt-1 italic">ID: {currentUser.uid.toUpperCase()}</p>
                  </div>
               </div>
            </div>
          </div>
          
          <button 
            onClick={downloadPDF}
            disabled={isGeneratingPDF}
            className="w-full max-w-[340px] bg-brand-500 text-slate-900 py-6 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50 mt-10 rounded-none"
          >
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={18}/> : <><Download size={20}/> DESCARGAR CREDENCIAL PDF</>}
          </button>
        </div>
      )}
    </div>
  );
}