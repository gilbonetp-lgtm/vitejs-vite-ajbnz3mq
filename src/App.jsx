import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { 
  PlusCircle, 
  Calendar, 
  User, 
  Stethoscope, 
  UserRound, 
  Activity, 
  Save,
  Clock,
  Trash2,
  CheckCircle2,
  Download,
  AlertCircle,
  XCircle,
  LogOut,
  Lock,
  CreditCard // Icono para la mútua
} from 'lucide-react';

// --- TUS CLAVES DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBaDpn7RI2n98S8MeB8ed-ufovBpwruuYo",
  authDomain: "cortgn-b2f1b.firebaseapp.com",
  projectId: "cortgn-b2f1b",
  storageBucket: "cortgn-b2f1b.firebasestorage.app",
  messagingSenderId: "874745086688",
  appId: "1:874745086688:web:c71e782a15b01e91420685",
  measurementId: "G-LC31P6Z7MV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'cortgn-b2f1b'; 

// --- LISTAS DE DATOS ---
const PROCEDIMIENTOS = [
  "Consulta",
  "ECG",
  "Ecocardiograma",
  "Holter ECG",
  "Holter TA",
  "Ergometría",
  "Tilt test",
  "Interconsulta",
  "EEF",
  "Ablación",
  "Coronariografía",
  "Angioplastia",
  "Cardioversión",
  "ECOTE"
];

const MEDICOS = [
  "Ramón de Castro",
  "Gil Bonet",
  "Mauricio Torres",
  "Anna Crrasquer",
  "Gabriel Martín",
  "Roberto Bejarano",
  "Adel Musa"
];

const MUTUAS = [
  "Adeslas",
  "ASISA",
  "DKV",
  "MAPFRE",
  "Sanitas",
  "Privado",
  "AXA",
  "Fiatc",
  "Cigna",
  "Mútua General de Catalunya",
  "Allianz",
  "Otra"
];

export default function App() {
  const [user, setUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null); 
  const [registros, setRegistros] = useState([]);
  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    nombrePaciente: '',
    fechaVisita: new Date().toISOString().split('T')[0],
    procedimiento: '',
    mutua: '', // Nuevo campo
    medico: ''
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error de autenticación:", error);
        setErrorMsg("Error de conexión: " + error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'registros_medicos'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistros(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      if (error.code === 'permission-denied') setErrorMsg("Falta configurar permisos (Reglas Firestore).");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentProfile) {
      setFilteredRegistros([]);
      return;
    }
    if (currentProfile.role === 'admin') {
      setFilteredRegistros(registros);
    } else {
      setFilteredRegistros(registros.filter(r => r.medico === currentProfile.name));
    }
  }, [registros, currentProfile]);

  useEffect(() => {
    if (currentProfile?.role === 'medico') {
      setFormData(prev => ({ ...prev, medico: currentProfile.name }));
    }
  }, [currentProfile]);

  const handleLogin = (name, role) => {
    setCurrentProfile({ name, role });
    setFormData(prev => ({ ...prev, medico: role === 'medico' ? name : '' }));
  };

  const handleLogout = () => {
    setCurrentProfile(null);
    setFilteredRegistros([]);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'registros_medicos'), {
        ...formData,
        createdAt: serverTimestamp(),
        userId: user.uid,
        createdBy: currentProfile.name 
      });
      setFormData(prev => ({
        ...prev,
        nombrePaciente: '',
        procedimiento: '',
        mutua: '', // Reseteamos la mútua
        medico: currentProfile.role === 'medico' ? currentProfile.name : prev.medico
      }));
      setSuccessMsg('Registro añadido correctamente');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      setErrorMsg("Error al guardar: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registros_medicos', id));
      setSuccessMsg('Registro eliminado');
      setConfirmDeleteId(null);
    } catch (error) {
      setErrorMsg("No se pudo eliminar.");
    }
  };

  const exportToCSV = () => {
    if (filteredRegistros.length === 0) {
      setErrorMsg("No hay registros visibles.");
      return;
    }
    // Añadida columna Mútua al CSV
    let csvContent = "Nombre Paciente,Fecha Visita,Mutua,Procedimiento,Medico,Fecha Creacion\n";
    filteredRegistros.forEach(reg => {
      const row = [
        `"${reg.nombrePaciente}"`,
        `"${reg.fechaVisita}"`,
        `"${reg.mutua || ''}"`, // Exportar mútua
        `"${reg.procedimiento}"`,
        `"${reg.medico}"`,
        `"${reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleString() : ''}"`
      ].join(",");
      csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registros_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user && loading) return <div className="flex h-screen items-center justify-center text-slate-500 animate-pulse">Conectando...</div>;

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-blue-600 p-8 text-center">
            <Activity className="h-12 w-12 text-white mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Gestión Clínica Cor TGN</h1>
            <p className="text-blue-100 mt-2">Seleccione su perfil de acceso</p>
          </div>
          <div className="p-6 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Personal Médico</p>
            {MEDICOS.map(medico => (
              <button key={medico} onClick={() => handleLogin(medico, 'medico')} className="w-full p-4 flex items-center gap-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-full group-hover:bg-blue-200"><UserRound className="h-5 w-5" /></div>
                <div><div className="font-semibold text-slate-700">Dr/a. {medico}</div><div className="text-xs text-slate-500">Acceso Médico</div></div>
              </button>
            ))}
            <div className="border-t border-slate-100 my-4 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Administración</p>
              <button onClick={() => handleLogin('Recepción', 'admin')} className="w-full p-4 flex items-center gap-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group">
                <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full group-hover:bg-indigo-200"><Lock className="h-5 w-5" /></div>
                <div><div className="font-semibold text-slate-700">Recepción / Admin</div><div className="text-xs text-slate-500">Acceso Global</div></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      <header className={`${currentProfile.role === 'admin' ? 'bg-indigo-600' : 'bg-blue-600'} text-white p-4 shadow-lg sticky top-0 z-10`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-bold">Gestión Clínica</h1>
              <div className="text-xs opacity-90 flex gap-1 items-center">
                {currentProfile.role === 'admin' ? <Lock className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {currentProfile.role === 'medico' ? `Dr/a. ${currentProfile.name}` : currentProfile.name}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full flex gap-1 items-center"><LogOut className="h-3.5 w-3.5" /> Salir</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {(successMsg || errorMsg) && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex gap-3 z-50 animate-in slide-in-from-bottom-5 ${successMsg ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {successMsg ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="font-medium text-sm">{successMsg || errorMsg}</p>
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center gap-2">
            <PlusCircle className={`h-5 w-5 ${currentProfile.role === 'admin' ? 'text-indigo-600' : 'text-blue-600'}`} />
            <h2 className="font-semibold text-slate-700">Nuevo Registro</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-600 flex gap-1"><User className="h-4 w-4" /> Paciente</label><input type="text" name="nombrePaciente" required placeholder="Nombre y Apellidos" value={formData.nombrePaciente} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-600 flex gap-1"><Calendar className="h-4 w-4" /> Fecha</label><input type="date" name="fechaVisita" required value={formData.fechaVisita} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600 flex gap-1"><CreditCard className="h-4 w-4" /> Mútua</label>
                <div className="relative">
                  <select name="mutua" required value={formData.mutua} onChange={handleChange} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seleccionar Mútua...</option>
                    {MUTUAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600 flex gap-1"><Stethoscope className="h-4 w-4" /> Procedimiento</label>
                <div className="relative">
                  <select name="procedimiento" required value={formData.procedimiento} onChange={handleChange} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Seleccionar...</option>
                    {PROCEDIMIENTOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600 flex gap-1"><UserRound className="h-4 w-4" /> Médico</label>
              <div className="relative">
                {currentProfile.role === 'medico' ? (
                  <div className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 flex gap-2 cursor-not-allowed">
                    <UserRound className="h-4 w-4 opacity-50" />{currentProfile.name}
                  </div>
                ) : (
                  <select name="medico" required value={formData.medico} onChange={handleChange} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Seleccionar...</option>
                    {MEDICOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="pt-2"><button type="submit" disabled={submitting} className={`w-full py-3 rounded-lg font-semibold text-white shadow-md flex justify-center gap-2 ${submitting ? 'bg-slate-400' : currentProfile.role === 'admin' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{submitting ? 'Guardando...' : <><Save className="h-5 w-5" /> Registrar Visita</>}</button></div>
          </form>
        </section>

        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-semibold text-slate-700 flex gap-2"><Clock className="h-4 w-4" /> {currentProfile.role === 'admin' ? 'Todos los Registros' : 'Mis Pacientes'}</h3>
            <div className="flex gap-2"><button onClick={exportToCSV} className="flex gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full"><Download className="h-3.5 w-3.5" /> CSV</button><span className="text-xs text-slate-500 bg-slate-200 px-2 py-1.5 rounded-full">Total: {filteredRegistros.length}</span></div>
          </div>
          <div className="space-y-3">
            {loading ? <div className="text-center py-10 text-slate-400">Cargando...</div> : filteredRegistros.length === 0 ? <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">No hay registros.</div> : filteredRegistros.map((reg) => (
              <div key={reg.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between gap-4 hover:shadow-md transition-shadow group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-lg">{reg.nombrePaciente}</span>
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{reg.fechaVisita}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex gap-1 items-center font-medium text-slate-700"><CreditCard className="h-3 w-3" /> {reg.mutua}</span>
                    <span className="flex gap-1 items-center"><Stethoscope className="h-3 w-3" /> {reg.procedimiento}</span>
                    {currentProfile.role === 'admin' && <span className="flex gap-1 items-center text-indigo-600"><UserRound className="h-3 w-3" /> {reg.medico}</span>}
                  </div>
                </div>
                <div className="self-end sm:self-center">{confirmDeleteId === reg.id ? <div className="flex gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100"><button onClick={() => executeDelete(reg.id)} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md">Sí, borrar</button><button onClick={() => setConfirmDeleteId(null)} className="text-slate-500 hover:bg-white p-1 rounded-md"><XCircle className="h-5 w-5" /></button></div> : <button onClick={() => setConfirmDeleteId(reg.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-5 w-5" /></button>}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
