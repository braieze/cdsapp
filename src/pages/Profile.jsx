import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  User, Save, Edit3, Shield, Briefcase, LogOut, Camera,
  Loader2, CreditCard, X, Download, Phone, Calendar as CalendarIcon, 
  MapPin, Heart, ChevronRight, Settings, Plus, Trash2
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

  // Estados para Áreas Dinámicas (Sincronizado con Directorio)
  const [officialAreas, setOfficialAreas] = useState(['ninguna']);
  const [isManagingAreas, setIsManagingAreas] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');

  const CLOUD_NAME = "djmkggzjp";
  const UPLOAD_PRESET = "ml_default";

  const [formData, setFormData] = useState({
    phone: '', address: '', birthday: '', dni: '',
    bloodType: '', emergencyName: '', emergencyPhone: '', area: 'ninguna'
  });

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

  // 2. Cargar Áreas Oficiales (Misma lógica que Directorio)
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

      {/* HEADER PERFIL */}
      <div className="relative mb-20">
        <div className="h-48 bg-slate-900 w-full rounded-b-[50px] shadow-2xl overflow-hidden relative border-b-4 border-brand-500/30">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]"></div>
          <div className="h-full flex flex-col items-center justify-center pb-8">
            <span className="text-white font-black text-5xl tracking-tighter italic">CDS</span>
            <span className="text-brand-400 font-black text-[10px] uppercase tracking-[0.4em] mt-2 text-center">Identidad Ministerial</span>
          </div>
          {/* Botón Gestor Áreas (Solo Pastor) */}
          {userRole === 'pastor' && (
            <button onClick={() => setIsManagingAreas(true)} className="absolute top-12 right-6 p-2.5 bg-white/10 text-white rounded-2xl active:scale-75 transition-all border border-white/10">
                <Settings size={20} />
            </button>
          )}
        </div>

        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-36 h-36 rounded-[40px] border-4 border-white overflow-hidden shadow-2xl bg-white flex-shrink-0">
              <img src={displayPhoto} className={`w-full h-full object-cover ${uploadingPhoto ? 'opacity-30' : ''}`} referrerPolicy="no-referrer" />
            </div>
            <label className="absolute bottom-1 right-1 bg-brand-600 text-white p-3 rounded-2xl border-4 border-white shadow-xl cursor-pointer active:scale-75 transition-all">
              {uploadingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <input type="file" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
        </div>
      </div>

      <div className="text-center px-8 mb-10 mt-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none truncate">{currentUser?.displayName}</h1>
        <div className="flex justify-center flex-wrap gap-3 mt-4">
          <span className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
            <Shield size={12} className="text-brand-400" /> {userRole}
          </span>
          <span className="px-4 py-1.5 rounded-xl bg-white text-brand-600 text-[9px] font-black uppercase tracking-widest border-2 border-brand-50 flex items-center gap-2 shadow-sm">
            <Briefcase size={12} /> {formData.area}
          </span>
        </div>
      </div>

      {!isEditing && (
        <div className="px-6 mb-10">
          <button onClick={() => setShowCredential(true)} className="w-full bg-white border-2 border-slate-100 text-slate-900 p-5 rounded-[28px] flex items-center justify-between shadow-xl shadow-slate-200/30 active:scale-95 transition-all">
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
              <User size={18} className="text-brand-600" /> Datos del Miembro
            </h3>
            <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-emerald-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400 active:scale-75'}`}>
              {isEditing ? <Save size={20} /> : <Edit3 size={20} />}
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">WhatsApp de Contacto</label>
                <input disabled={!isEditing} type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" placeholder="11..." />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Ministerio / Área</label>
                <select 
                    disabled={!isEditing} 
                    value={formData.area} 
                    onChange={e => setFormData({ ...formData, area: e.target.value })} 
                    className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-black uppercase border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all"
                >
                    {officialAreas.map(a => <option key={a} value={a.toLowerCase()}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">DNI</label>
                <input disabled={!isEditing} value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Grupo Sanguíneo</label>
                <input disabled={!isEditing} value={formData.bloodType} onChange={e => setFormData({ ...formData, bloodType: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-black border-2 border-transparent focus:border-brand-500 outline-none uppercase disabled:text-slate-500 transition-all text-center" placeholder="--"/>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-3 flex items-center gap-2"><MapPin size={10}/> Domicilio Actual</label>
              <input disabled={!isEditing} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" placeholder="Calle y altura..." />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-3 flex items-center gap-2"><CalendarIcon size={10}/> Fecha de Nacimiento</label>
              <input disabled={!isEditing} type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-slate-50 p-4 rounded-[20px] text-sm font-bold border-2 border-transparent focus:border-brand-500 outline-none disabled:text-slate-500 transition-all" />
            </div>

            {/* EMERGENCIA */}
            <div className="bg-rose-50/50 p-6 rounded-[30px] border-2 border-rose-50 space-y-4">
              <label className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2 tracking-widest ml-1"><Heart size={14} fill="currentColor"/> En caso de emergencia</label>
              <div className="space-y-3">
                <input disabled={!isEditing} value={formData.emergencyName} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100 outline-none shadow-sm" placeholder="Nombre de contacto" />
                <input disabled={!isEditing} value={formData.emergencyPhone} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-rose-100 outline-none shadow-sm" placeholder="Teléfono de contacto" />
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 text-rose-600 font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-[28px] bg-rose-50/50 border-2 border-rose-100 active:scale-95 transition-all">
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </div>

      {/* MODAL GESTOR DE ÁREAS (PASTOR) */}
      {isManagingAreas && (
        <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestor de Áreas</h2>
                <button onClick={() => setIsManagingAreas(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 active:scale-75"><X size={20}/></button>
              </div>
              <div className="flex gap-2 mb-6">
                 <input placeholder="Nueva área..." className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none" value={newAreaInput} onChange={e => setNewAreaInput(e.target.value)} />
                 <button onClick={handleAddArea} className="bg-slate-900 text-white p-4 rounded-xl active:scale-90 transition-all"><Plus size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                  {officialAreas.map(area => (
                    <div key={area} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
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

      {/* MODAL CREDENCIAL DIGITAL (PREMIUM & RESPONSIVE) */}
      {showCredential && (
        <div className="fixed inset-0 z-[600] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in overflow-y-auto">
          {/* Botón Cerrar X */}
          <button onClick={() => setShowCredential(false)} className="absolute top-10 right-8 text-white p-4 bg-white/10 rounded-full active:scale-75 transition-all border border-white/20 z-[700]">
            <X size={32} />
          </button>

          <div className="w-full flex justify-center items-center py-10 scale-[0.85] sm:scale-100">
            <div ref={credentialRef} className="w-[340px] bg-white rounded-[45px] overflow-hidden shadow-2xl relative flex flex-col animate-scale-in border-4 border-white">
                <div className="p-10 pb-12 flex flex-col items-center bg-white flex-1">
                <div className="w-40 h-40 rounded-[45px] border-8 border-slate-50 shadow-inner overflow-hidden mb-6 bg-slate-50 flex-shrink-0">
                    <img src={displayPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2 text-center">{currentUser?.displayName}</h3>
                <p className="text-sm font-black text-brand-600 uppercase tracking-[0.2em] mb-4">{userRole}</p>
                
                <div className="grid grid-cols-2 gap-6 w-full mt-6 pt-6 border-t border-slate-100">
                    <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID Miembro</p>
                    <p className="text-xs font-black text-slate-800 mt-1 uppercase">{currentUser.uid.slice(0, 8)}</p>
                    </div>
                    <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Área</p>
                    <p className="text-xs font-black text-slate-800 mt-1 uppercase truncate w-full px-1">{formData.area}</p>
                    </div>
                </div>

                <div className="mt-10 p-5 bg-slate-50 rounded-[35px] border-2 border-slate-50 shadow-inner">
                    <QRCodeCanvas 
                        value={`CDS_APP_VERIFY_${currentUser.uid}`} 
                        size={100} 
                        level="H" 
                        bgColor={"#f8fafc"} 
                        fgColor={"#0f172a"}
                    />
                </div>
                </div>

                <div className="h-24 bg-slate-900 w-full flex items-center justify-between px-10 border-t-4 border-brand-500">
                <span className="text-white font-black text-2xl tracking-tighter italic">CDS</span>
                <div className="w-12 h-12 bg-brand-500/20 rounded-2xl flex items-center justify-center">
                    <Shield size={28} className="text-brand-500"/>
                </div>
                </div>
            </div>
          </div>

          <button onClick={downloadPDF} disabled={isGeneratingPDF} className="w-full max-w-[340px] bg-brand-600 text-white py-5 rounded-[28px] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={22} /> : <><Download size={22} /> Guardar como Imagen / PDF</>}
          </button>
        </div>
      )}
    </div>
  );
}