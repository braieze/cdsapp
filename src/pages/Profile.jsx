import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  User, Phone, MapPin, Calendar, Save, Edit3, Shield, 
  Briefcase, LogOut, Camera, Loader2, MessageCircle, 
  Heart, Fingerprint, Download, CreditCard, X
} from 'lucide-react';
import { signOut } from 'firebase/auth'; // ✅ Aseguramos la importación de signOut
import imageCompression from 'browser-image-compression';

// ✅ IMPORTACIÓN DE LIBRERÍAS (Requiere: npm install jspdf html2canvas)
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

  // ✅ DEFINICIÓN DE handleLogout (CORRIGE EL ERROR)
  const handleLogout = () => {
    if (window.confirm("¿Cerrar sesión de Conquistadores?")) {
      signOut(auth).catch((error) => console.error("Error al salir:", error));
    }
  };

  // ✅ GENERADOR DE PDF PROFESIONAL
  const downloadPDF = async () => {
    if (!credentialRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(credentialRef.current, {
        scale: 3, 
        useCORS: true, 
        backgroundColor: "#ffffff",
        borderRadius: 40
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 3, canvas.height / 3]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 3, canvas.height / 3);
      pdf.save(`Credencial_MCEH_${currentUser.displayName.replace(/\s/g, '_')}.pdf`);
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
      
      {/* PORTADA Y FOTO */}
      <div className="relative mb-16">
        <div className="h-44 bg-slate-900 w-full rounded-b-[50px] shadow-2xl flex items-center justify-center">
           <h2 className="text-white/10 font-black text-6xl uppercase tracking-tighter select-none">PERFIL</h2>
        </div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="relative group">
            <img src={displayPhoto} className={`w-32 h-32 rounded-[40px] border-4 border-white object-cover shadow-2xl bg-white ${uploadingPhoto ? 'opacity-50' : ''}`} />
            <label className="absolute -bottom-2 -right-2 bg-brand-600 text-white p-2.5 rounded-2xl border-4 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
              <Camera size={18} />
              <input type="file" className="hidden" onChange={handlePhotoUpload}/>
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-6 mb-8">
        <h1 className="text-2xl font-black text-slate-800 leading-tight">{currentUser?.displayName}</h1>
        <div className="flex justify-center gap-2 mt-3">
          <span className="px-3 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm"><Shield size={12} /> {userData?.role || 'Miembro'}</span>
          <span className="px-3 py-1 rounded-xl bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-widest border border-brand-100 flex items-center gap-1.5 shadow-sm"><Briefcase size={12} /> {formData.ministerio || 'Sin Área'}</span>
        </div>
      </div>

      {/* QUICK ACTIONS SMART */}
      {!isEditing && (
        <div className="px-4 mb-6 grid grid-cols-2 gap-3">
           <a href={`https://wa.me/${formData.phone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="bg-emerald-50 text-emerald-700 p-5 rounded-[30px] border border-emerald-100 flex flex-col items-center gap-2 active:scale-95 transition-all shadow-sm">
              <MessageCircle size={24}/>
              <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
           </a>
           <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address || '')}`} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 p-5 rounded-[30px] border border-blue-100 flex flex-col items-center gap-2 active:scale-95 transition-all shadow-sm">
              <MapPin size={24}/>
              <span className="text-[10px] font-black uppercase tracking-widest">Ubicación</span>
           </a>
           <button onClick={() => setShowCredential(true)} className="col-span-2 bg-slate-900 text-white p-5 rounded-[30px] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
              <CreditCard size={20} className="text-brand-400"/>
              <span className="text-xs font-black uppercase tracking-widest">Ver Credencial Digital</span>
           </button>
        </div>
      )}

      {/* FICHA TÉCNICA */}
      <div className="px-4 space-y-4">
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">DATOS DE SERVIDOR</h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
              {isEditing ? <Save size={20}/> : <Edit3 size={20}/>}
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI / Documento</label>
                  <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-bold border border-slate-100 outline-none disabled:text-slate-500 focus:ring-2 focus:ring-brand-500/20" placeholder="00.000.000" />
               </div>
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sangre</label>
                  <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({...formData, bloodType: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-bold border border-slate-100 outline-none uppercase disabled:text-slate-500 focus:ring-2 focus:ring-brand-500/20" placeholder="O+" />
               </div>
            </div>
            
            <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección Actual</label>
               <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-bold border border-slate-100 outline-none disabled:text-slate-500" placeholder="Calle y número..." />
            </div>

            <div className="bg-rose-50/30 p-5 rounded-[30px] border border-rose-100/50">
               <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-4 block">CONTACTO DE EMERGENCIA</label>
               <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100/50 outline-none mb-3" placeholder="Nombre" />
               <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100/50 outline-none" placeholder="Teléfono" />
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 text-rose-500 font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-[35px] bg-rose-50 border border-rose-100 active:scale-95 transition-all mt-4">
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>

      {/* ✅ MODAL CREDENCIAL CON GENERADOR PDF */}
      {showCredential && (
        <div className="fixed inset-0 z-[500] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
          
          <button onClick={() => setShowCredential(false)} className="absolute top-8 right-8 text-white/50 hover:text-white p-2 transition-colors"><X size={32}/></button>

          {/* EL CARNET (Lo que se captura) */}
          <div ref={credentialRef} className="w-full max-w-[300px] bg-white rounded-[40px] overflow-hidden shadow-2xl relative mb-10 border border-white">
            <div className="h-28 bg-brand-600 w-full flex items-center justify-center p-6 relative">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={60} className="text-white"/></div>
               <h2 className="text-white font-black uppercase tracking-tighter text-xl relative z-10">Conquistadores</h2>
            </div>
            <div className="p-8 text-center bg-white">
               <img src={displayPhoto} className="w-28 h-28 rounded-[35px] mx-auto -mt-20 border-8 border-white shadow-xl object-cover mb-4 bg-white" />
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{currentUser?.displayName}</h3>
               <p className="text-[10px] font-black text-brand-600 uppercase mb-8 tracking-widest">{formData.ministerio || 'SERVIDOR'}</p>
               
               <div className="grid grid-cols-2 gap-6 text-left border-t border-slate-50 pt-6">
                  <div><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">DNI</p><p className="text-xs font-black text-slate-700">{formData.dni || '-'}</p></div>
                  <div><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">SANGRE</p><p className="text-xs font-black text-slate-700">{formData.bloodType || '-'}</p></div>
               </div>
               
               <div className="mt-10 pt-6 border-t border-dashed border-slate-100 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100"><Shield size={24} className="text-slate-200"/></div>
                  <p className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.3em]">ID: {currentUser.uid.slice(0,10)}</p>
               </div>
            </div>
          </div>
          
          <button 
            onClick={downloadPDF}
            disabled={isGeneratingPDF}
            className="w-full max-w-[300px] bg-white text-slate-900 py-5 rounded-[30px] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
          >
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={18}/> : <><Download size={18} className="text-brand-600"/> Descargar Credencial</>}
          </button>
        </div>
      )}
    </div>
  );
}