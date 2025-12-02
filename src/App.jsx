import React, { useState, useEffect } from 'react';
import {
    collection, query, onSnapshot, addDoc, orderBy, updateDoc, doc
} from 'firebase/firestore';
import {
    signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import { db, auth } from './firebase';
import {
    Users, BookOpen, AlertTriangle, Activity,
    Search, Plus, LogOut, CheckCircle,
    ShieldAlert, Clock, Award, BarChart2, Bell, X, FileText,
    XCircle, Target,
    Filter, History // <-- Agregado
} from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// --- CONSTANTES DEL PLAN DE ESTUDIOS ---
const APP_ID = 'default-logicbot'; // Debe coincidir con APP_ID_DASHBOARD en database.py

const TEMAS_JAVA = [
    "Variables y Primitivos",
    "Operadores Lógicos",
    "Condicionales (if-else)",
    "Ciclos (for, while)",
    "Arrays (Arreglos)",
    "Métodos y Funciones",
    "Clases y Objetos (OOP)"
];

// --- COMPONENTES UI REUTILIZABLES ---
const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
        {children}
    </div>
);

const Badge = ({ type, text }) => {
    const styles = {
        success: "bg-green-100 text-green-800 border border-green-200",
        warning: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        danger: "bg-red-100 text-red-800 border border-red-200",
        neutral: "bg-gray-100 text-gray-800 border border-gray-200",
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.neutral}`}>
      {text}
    </span>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('classes'); // 'classes', 'dashboard', 'student'
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClassName, setNewClassName] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);

    // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
    const [alerts, setAlerts] = useState([]);
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    // NUEVO ESTADO PARA LOGS DE HISTORIAL Y FILTRO
    const [historyLogs, setHistoryLogs] = useState([]);
    const [selectedTopicFilter, setSelectedTopicFilter] = useState('Todos');

    // 1. Autenticación (Simulada para Docente según Plan Fase 2)
    useEffect(() => {
        const initAuth = async () => {
            // En producción, esto sería email/password
            await signInAnonymously(auth);
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // 2. Cargar Clases del Docente (Fase 2: Integración Institucional)
    useEffect(() => {
        if (!user) return;

        // Ruta: artifacts/{appId}/public/data/classes
        const q = collection(db, 'artifacts', APP_ID, 'public', 'data', 'classes');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filtramos por teacherId si implementamos auth real, por ahora mostramos todas para demo
            setClasses(classList);
            setLoading(false);
        }, (error) => {
            console.error("Error cargando clases:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // 3. Cargar Estudiantes de la Clase Seleccionada (Handshake)
    useEffect(() => {
        if (!selectedClass) {
            setStudents([]);
            return;
        }

        setLoading(true);
        // Leemos de 'users_sync' donde el backend Python escribe los datos públicos
        const q = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users_sync');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // FILTRADO CLAVE: Solo mostramos estudiantes con el Token de la clase
            const classStudents = allStudents.filter(s => s.class_token === selectedClass.token);

            setStudents(classStudents);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching students", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedClass]);

    // 4. ✅ NUEVO: ESCUCHAR ALERTAS DE SEGURIDAD (GLOBAL)
    useEffect(() => {
        if (!user) return;

        // Escuchamos la colección de alertas ordenadas por fecha
        const alertsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'alerts');
        const q = query(alertsRef, orderBy('creado_en', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAlerts(newAlerts);

            // Contar no leídas
            const unread = newAlerts.filter(a => !a.leida).length;
            setUnreadCount(unread);
        }, (error) => {
            console.error("Error listening to alerts:", error);
        });

        return () => unsubscribe();
    }, [user]);

    // 4. NUEVO LISTENER: ESCUCHAR LOGS DE ACTIVIDAD
    useEffect(() => {
        if (!user) return;
        const logsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'challenge_logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoryLogs(logs);
        }, (error) => console.error("Error logs:", error));
        return () => unsubscribe();
    }, [user]);

    // --- LÓGICA DE NEGOCIO ---

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return;

        // Generar Token Único (Plan Fase 2)
        // Formato: PROG-YEAR-XXX
        const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        const token = `PROG-${new Date().getFullYear()}-${suffix}`;

        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'classes'), {
                name: newClassName,
                token: token,
                createdAt: new Date().toISOString(),
                teacherId: user.uid,
                studentCount: 0
            });
            setShowCreateModal(false);
            setNewClassName("");
        } catch (e) {
            console.error("Error creating class:", e);
            alert("Error creando la clase. Revisa la consola/permisos.");
        }
    };

    // Cálculo de Autonomía (Plan Fase 3: Auditoría de Integridad)
    const calculateAutonomy = (student) => {
        if (!student.retos_completados || student.retos_completados === 0) return 0;
        const autonomos = student.retos_sin_pistas || 0;
        // Evitamos división por cero
        return Math.round((autonomos / student.retos_completados) * 100);
    };

    const getStatusColor = (percentage) => {
        if (percentage >= 80) return "bg-green-500"; // Dominio
        if (percentage >= 50) return "bg-yellow-400"; // En Proceso
        return "bg-red-400"; // Riesgo
    };

    const handleMarkAsRead = async (alertId) => {
        try {
            const alertRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'alerts', alertId);
            await updateDoc(alertRef, { leida: true });
        } catch (e) {
            console.error("Error marcando alerta como leída", e);
        }
    };

    // --- COMPONENTE DE NOTIFICACIONES DROPDOWN ---
    const AlertsDropdown = () => (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-500"/> Alertas de Integridad
                </h3>
                <button onClick={() => setShowAlertsPanel(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={16}/>
                </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {alerts.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">
                        No hay alertas recientes.
                    </div>
                ) : (
                    alerts.slice(0, 5).map(alert => (
                        <div
                            key={alert.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition relative ${!alert.leida ? 'bg-red-50/30' : ''}`}
                        >
                            {!alert.leida && <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full"></div>}

                            <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider border border-red-200 px-1 rounded bg-red-50">
                  Velocidad Anormal
                </span>
                                <span className="text-[10px] text-gray-400">
                  {new Date(alert.timestamp_alerta || alert.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                            </div>

                            <p className="text-sm font-bold text-gray-800 mb-1">{alert.nombre_estudiante}</p>

                            <div className="text-xs text-gray-600 space-y-1 mb-2">
                                <p>⚡ Respondió en <span className="font-bold text-red-600">{alert.tiempo_tomado}s</span></p>
                                <p className="opacity-80">(Estimado IA: {alert.tiempo_estimado}s)</p>
                            </div>

                            <div className="bg-gray-100 p-2 rounded text-[10px] font-mono text-gray-700 truncate">
                                {alert.respuesta_estudiante}
                            </div>

                            {!alert.leida && (
                                <button
                                    onClick={() => handleMarkAsRead(alert.id)}
                                    className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                                >
                                    Marcar como vista
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    // --- COMPONENTE DE TARJETA DE ALERTA (REUTILIZABLE) ---
    const AlertList = ({ filteredAlerts, showStudentName = true }) => (
        <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <ShieldAlert className="mx-auto mb-2 opacity-50" size={32} />
                    <p className="text-sm">No hay reportes de integridad registrados.</p>
                </div>
            ) : (
                filteredAlerts.map(alert => (
                    <div key={alert.id} className={`bg-white border rounded-lg p-4 shadow-sm transition relative overflow-hidden group ${alert.leida ? 'border-gray-200 opacity-80' : 'border-red-200 ring-1 ring-red-50'}`}>
                        {/* Indicador lateral de severidad */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${alert.leida ? 'bg-gray-300' : 'bg-red-500'}`}></div>

                        {/* Cabecera */}
                        <div className="flex justify-between items-start mb-3 pl-2">
                            <div>
                                {showStudentName && <h4 className="font-bold text-gray-800 text-sm">{alert.nombre_estudiante}</h4>}
                                <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wide">
                            Velocidad Anormal
                        </span>
                                    {!alert.leida && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 flex items-center justify-end gap-1">
                                    <Clock size={10}/> Reportado: {new Date(alert.timestamp_alerta || alert.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                                <p className="text-[10px] text-gray-500 font-medium">
                                    Fecha: {new Date(alert.timestamp_alerta || alert.creado_en).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Datos Forenses */}
                        <div className="grid grid-cols-2 gap-3 mb-3 bg-gray-50 p-3 rounded border border-gray-100 ml-2">
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Análisis Temporal</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Estimado IA:</span>
                                        <span className="font-mono font-bold text-gray-700">{alert.tiempo_estimado}s</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Realizado:</span>
                                        <span className="font-mono font-bold text-red-600 bg-red-50 px-1 rounded">{alert.tiempo_tomado}s</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Contexto</p>
                                <p className="text-[10px] text-gray-500">
                                    Inicio: {alert.timestamp_envio ? new Date(alert.timestamp_envio).toLocaleTimeString() : 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Evidencia: Reto y Respuesta */}
                        <div className="space-y-2 ml-2">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Reto Asignado</p>
                                <p className="text-xs text-gray-700 italic line-clamp-2 hover:line-clamp-none transition-all cursor-help bg-white border border-gray-100 p-2 rounded">
                                    "{alert.reto_enunciado}"
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Código Enviado</p>
                                <pre className="bg-slate-900 text-green-400 p-2 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto custom-scrollbar border border-slate-700">
                        {alert.respuesta_estudiante}
                    </pre>
                            </div>
                        </div>

                        {/* Acciones */}
                        {!alert.leida && (
                            <div className="flex justify-end mt-3 border-t border-gray-100 pt-2">
                                <button
                                    onClick={() => handleMarkAsRead(alert.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition"
                                >
                                    <CheckCircle size={14} /> Marcar como revisado
                                </button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );

    // --- COMPONENTE NUEVO: LISTA DE HISTORIAL CON FILTRO ---
    const HistoryList = ({ studentLogs }) => {
        const temasDisponibles = ['Todos', ...new Set(studentLogs.map(log => log.tema))];
        const logsFiltrados = selectedTopicFilter === 'Todos'
            ? studentLogs
            : studentLogs.filter(log => log.tema === selectedTopicFilter);
        return (
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                        <History className="text-blue-600"/> Historial Académico
                    </h3>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                        <Filter size={14} className="text-gray-400"/>
                        <select
                            className="text-xs font-medium text-gray-600 bg-transparent outline-none cursor-pointer"
                            value={selectedTopicFilter}
                            onChange={(e) => setSelectedTopicFilter(e.target.value)}
                        >
                            {temasDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar max-h-[600px]">
                    {logsFiltrados.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs">Sin actividad registrada.</div>
                    ) : (
                        logsFiltrados.map(log => (
                            <div key={log.id} className={`bg-white border rounded-lg p-3 shadow-sm relative overflow-hidden transition hover:shadow-md
                                ${log.es_sospechoso ? 'border-red-200 ring-1 ring-red-50' : 'border-gray-200'}
                            `}>
                                <div className={`absolute top-0 left-0 w-1 h-full 
                                    ${log.es_sospechoso ? 'bg-red-500' : 
                                      log.resultado === 'CORRECTO' ? 'bg-green-500' : 'bg-gray-400'}
                                `}></div>
                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {log.tema}
                                            </span>
                                            {log.es_sospechoso && (
                                                <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                                                    VELOCIDAD ANORMAL
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(log.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <p className="text-[10px] text-gray-500 font-medium mb-0.5">Reto:</p>
                                        <p className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100 line-clamp-2 hover:line-clamp-none transition-all cursor-help" title={log.enunciado}>
                                            {log.enunciado}
                                        </p>
                                    </div>
                                    <div className="mb-2">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <p className="text-[10px] text-gray-500 font-medium">Respuesta:</p>
                                            <div className="flex gap-2 text-[10px]">
                                                <span className="text-gray-400">Est: {log.tiempo_estimado}s</span>
                                                <span className={`font-mono font-bold ${log.es_sospechoso ? 'text-red-600' : 'text-blue-600'}`}>Real: {log.tiempo_tomado}s</span>
                                            </div>
                                        </div>
                                        <pre className={`font-mono text-[10px] p-2 rounded overflow-x-auto border
                                            ${log.resultado === 'CORRECTO' 
                                                ? 'bg-green-50 text-green-800 border-green-100' 
                                                : 'bg-gray-100 text-gray-600 border-gray-200'}
                                        `}>
                                            {log.respuesta}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    // --- VISTAS ---

    // VISTA 1: LISTADO DE CLASES
    const renderClassList = () => (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Aulas Virtuales</h2>
                    <p className="text-gray-500 mt-1">Gestiona tus grupos de programación Java.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 font-medium"
                >
                    <Plus size={20} /> Crear Clase
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((cls) => (
                    <div
                        key={cls.id}
                        onClick={() => { setSelectedClass(cls); setView('dashboard'); }}
                        className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:bg-blue-600 transition"></div>
                        <div className="flex justify-between items-start mb-4 pl-2">
                            <h3 className="text-xl font-bold text-gray-800">{cls.name}</h3>
                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-sm font-mono font-bold border border-blue-100">
                                {cls.token}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-gray-500 text-sm pl-2">
                            <div className="flex items-center gap-1.5">
                                <Users size={16} />
                                <span>Acceder al aula</span>
                            </div>
                        </div>
                    </div>
                ))}

                {classes.length === 0 && !loading && (
                    <div className="col-span-full py-16 text-center bg-white rounded-xl border-2 border-dashed border-gray-200">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="text-gray-400" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No hay clases activas</h3>
                        <p className="text-gray-500">Crea tu primera clase para generar un token de acceso.</p>
                    </div>
                )}
            </div>
        </div>
    );

    // VISTA 2: DASHBOARD DE CLASE (Torre de Control)
    const renderClassDashboard = () => {
        const totalStudents = students.length;
        // Estudiantes activos hoy
        const activeStudents = students.filter(s => {
            if(!s.ultima_conexion) return false;
            return new Date(s.ultima_conexion).toDateString() === new Date().toDateString();
        }).length;

        return (
            <div className="space-y-8 animate-in slide-in-from-right duration-300 max-w-7xl mx-auto">
                {/* Header de Navegación */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
                    <div>
                        <button
                            onClick={() => { setSelectedClass(null); setView('classes'); }}
                            className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-1 mb-2 font-medium transition"
                        >
                            ← Volver a mis clases
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900">{selectedClass.name}</h1>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm text-gray-500">Token de vinculación:</span>
                            <code
                                className="bg-gray-100 px-3 py-1 rounded text-gray-800 font-mono font-bold cursor-pointer hover:bg-gray-200 transition"
                                onClick={() => navigator.clipboard.writeText(selectedClass.token)}
                                title="Clic para copiar"
                            >
                                {selectedClass.token}
                            </code>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Card className="!p-4 flex items-center gap-4 min-w-[160px]">
                            <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Users size={24}/></div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase">Alumnos</p>
                                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                            </div>
                        </Card>
                        <Card className="!p-4 flex items-center gap-4 min-w-[160px]">
                            <div className="bg-green-100 p-3 rounded-full text-green-600"><Activity size={24}/></div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase">Activos Hoy</p>
                                <p className="text-2xl font-bold text-gray-900">{activeStudents}</p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* 📊 SECCIÓN DE ANALÍTICA AVANZADA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* 1. RADAR DE CONOCIMIENTO (Promedio de la Clase) */}
                    <Card className="flex flex-col items-center justify-center min-h-[350px]">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 w-full text-left flex items-center gap-2">
                            <Activity className="text-purple-600" /> Radar de Conocimiento
                        </h3>
                        <p className="text-xs text-gray-500 w-full text-left mb-4">Nivel promedio de la clase por tema</p>

                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
                                    TEMAS_JAVA.map(tema => {
                                        // Calcular promedio del nivel de todos los estudiantes para este tema
                                        const totalNivel = students.reduce((acc, s) => {
                                            const temas = JSON.parse(s.progreso_temas || '{}');
                                            return acc + (temas[tema]?.nivel || 1);
                                        }, 0);
                                        const promedio = students.length ? (totalNivel / students.length) : 0;

                                        return {
                                            subject: tema.split(" ")[0], // Nombre corto (Variables, Ciclos...)
                                            A: promedio,
                                            fullMark: 5 // Nivel máximo esperado
                                        };
                                    })
                                }>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Clase Actual"
                                        dataKey="A"
                                        stroke="#2563eb"
                                        fill="#3b82f6"
                                        fillOpacity={0.5}
                                    />
                                    <Tooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* 2. CURVA DE RETENCIÓN (Estado de Actividad) */}
                    <Card>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Clock className="text-orange-500" /> Estado de Actividad
                        </h3>
                        <div className="flex items-center justify-center h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Activos (<3 días)', value: students.filter(s => {
                                                    if(!s.ultima_conexion) return false;
                                                    const diff = new Date() - new Date(s.ultima_conexion);
                                                    return diff < 3 * 24 * 60 * 60 * 1000;
                                                }).length
                                            },
                                            { name: 'En Riesgo (3-7 días)', value: students.filter(s => {
                                                    if(!s.ultima_conexion) return false;
                                                    const diff = new Date() - new Date(s.ultima_conexion);
                                                    return diff >= 3 * 24 * 60 * 60 * 1000 && diff < 7 * 24 * 60 * 60 * 1000;
                                                }).length
                                            },
                                            { name: 'Inactivos (>7 días)', value: students.filter(s => {
                                                    if(!s.ultima_conexion) return true; // Si no hay fecha, es inactivo
                                                    const diff = new Date() - new Date(s.ultima_conexion);
                                                    return diff >= 7 * 24 * 60 * 60 * 1000;
                                                }).length
                                            },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {/* Colores: Verde, Amarillo, Rojo */}
                                        <Cell fill="#10B981" />
                                        <Cell fill="#F59E0B" />
                                        <Cell fill="#EF4444" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-500">
                            Total estudiantes: <span className="font-bold text-gray-800">{students.length}</span>
                        </div>
                    </Card>
                </div>

                {/* MATRIZ DE HABILIDADES (Heatmap) - Plan Fase 3 */}
                <Card>
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                                <BarChart2 className="text-blue-600" /> Matriz de Habilidades
                            </h3>
                            <p className="text-sm text-gray-500">Monitoreo de progreso por tema y estudiante</p>
                        </div>
                        <div className="flex gap-3 text-xs bg-gray-50 p-2 rounded-lg">
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Dominio</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> En Proceso</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded-sm"></div> Riesgo</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                            <tr className="border-b border-gray-200">
                                <th className="px-4 py-3 text-gray-500 font-medium w-1/4">Estudiante</th>
                                {TEMAS_JAVA.map(tema => (
                                    <th key={tema} className="px-2 py-3 text-center text-gray-500 font-medium text-xs truncate max-w-[100px]" title={tema}>
                                        {tema.split(' ')[0]}...
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-gray-500 font-medium">Autonomía</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {students.map((student) => {
                                const temas = JSON.parse(student.progreso_temas || '{}');
                                const autonomia = calculateAutonomy(student);

                                return (
                                    <tr
                                        key={student.id}
                                        className="hover:bg-blue-50/50 cursor-pointer transition duration-150"
                                        onClick={() => { setSelectedStudent(student); setView('student'); }}
                                    >
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-900">{student.nombre || "Sin Nombre"}</div>
                                            <div className="text-xs text-gray-400 font-mono">{student.numero_telefono}</div>
                                        </td>
                                        {TEMAS_JAVA.map(tema => {
                                            const nivel = temas[tema]?.nivel || 1;
                                            // Nivel máximo asumido: 5
                                            const score = (nivel / 5) * 100;

                                            return (
                                                <td key={tema} className="px-2 py-3">
                                                    <div className="flex justify-center">
                                                        <div
                                                            className={`w-full max-w-[60px] h-8 rounded-md ${getStatusColor(score)} bg-opacity-90 flex items-center justify-center text-white font-bold text-xs shadow-sm`}
                                                            title={`Nivel ${nivel} en ${tema}`}
                                                        >
                                                            Lvl {nivel}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                type={autonomia > 75 ? 'success' : autonomia > 40 ? 'warning' : 'danger'}
                                                text={`${autonomia}%`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>

                        {students.length === 0 && (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-b-xl">
                                <p className="mb-2">No hay estudiantes vinculados a esta clase aún.</p>
                                <p className="text-sm">
                                    Pídeles que envíen: <code className="bg-white border border-gray-200 px-2 py-1 rounded font-bold text-blue-600">unirse {selectedClass.token}</code> al bot.
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Paneles Inferiores: Integridad y Líderes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Panel de Auditoría de Integridad */}
                    <Card className="border-l-4 border-l-red-500">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
                            <ShieldAlert className="text-red-500" /> Auditoría de Integridad
                        </h3>
                        <div className="space-y-4">
                            {students.filter(s => calculateAutonomy(s) < 40 && s.retos_completados > 2).map(s => (
                                <div key={s.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="text-red-500" size={18} />
                                        <div>
                                            <p className="font-bold text-gray-800">{s.nombre}</p>
                                            <p className="text-xs text-red-600 font-medium">
                                                Alta dependencia de pistas ({100 - calculateAutonomy(s)}% ayuda)
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedStudent(s); setView('student'); }}
                                        className="text-xs bg-white border border-red-200 px-3 py-1.5 rounded-md text-red-700 hover:bg-red-50 font-medium"
                                    >
                                        Revisar Logs
                                    </button>
                                </div>
                            ))}
                            {students.filter(s => calculateAutonomy(s) < 40).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-green-600 bg-green-50 rounded-lg border border-green-100 border-dashed">
                                    <CheckCircle size={32} className="mb-2 opacity-50" />
                                    <p className="font-medium">No se detectan riesgos de integridad graves.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Panel de Gamificación */}
                    <Card className="border-l-4 border-l-yellow-400">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
                            <Award className="text-yellow-500" /> Top Estudiantes (Líderes)
                        </h3>
                        <div className="space-y-3">
                            {[...students].sort((a,b) => (b.puntos || 0) - (a.puntos || 0)).slice(0, 3).map((s, idx) => (
                                <div key={s.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition border border-transparent hover:border-gray-100">
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-white shadow-sm ${
                                        idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800">{s.nombre}</p>
                                        <p className="text-xs text-gray-500">Nivel {s.nivel} • <span className="text-blue-600 font-medium">{s.puntos} pts</span></p>
                                    </div>
                                    <div className="text-right">
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                      🔥 {s.racha_dias} días
                    </span>
                                    </div>
                                </div>
                            ))}
                            {students.length === 0 && <p className="text-center text-gray-400 py-4 italic">Sin datos suficientes.</p>}
                        </div>
                    </Card>
                </div>
            </div>
        );
    };

    // VISTA 3: DETALLE ESTUDIANTE (Perfil 360°)
    const renderStudentDetail = () => {
        if (!selectedStudent) return null;
        const historial = JSON.parse(selectedStudent.historial_chat || '[]');
        const studentAlerts = alerts.filter(a => a.estudiante_id === selectedStudent.numero_telefono);
        const progresoTemas = JSON.parse(selectedStudent.progreso_temas || '{}');
        // Filtrar logs por estudiante
        const studentLogs = historyLogs.filter(l => l.estudiante_id === selectedStudent.numero_telefono);
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300 max-w-7xl mx-auto">
                <button
                    onClick={() => setView('dashboard')}
                    className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-1 font-medium transition"
                >
                    ← Volver al Dashboard
                </button>
                {/* 1. HEADER: Datos Personales */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{selectedStudent.nombre}</h1>
                                <div className="flex flex-wrap items-center gap-4 mt-2 opacity-90 text-sm">
                                    <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full"><Users size={14} /> {selectedStudent.numero_telefono}</span>
                                    <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full"><Clock size={14} /> Última vez: {selectedStudent.ultima_conexion}</span>
                                </div>
                            </div>
                            <div className="text-right bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                                <div className="text-3xl font-bold">{selectedStudent.puntos} <span className="text-base font-normal opacity-80">pts</span></div>
                                <div className="text-sm font-medium text-blue-200">Nivel General {selectedStudent.nivel}</div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* 2. STATS CARDS: Métricas Clave */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="flex items-center gap-4 border-l-4 border-l-orange-400">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-full">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Racha Actual</p>
                            <p className="text-xl font-bold text-gray-900">{selectedStudent.racha_dias || 0} días</p>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-4 border-l-4 border-l-blue-500">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Retos Resueltos</p>
                            <p className="text-xl font-bold text-gray-900">{selectedStudent.retos_completados || 0}</p>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-4 border-l-4 border-l-red-400">
                        <div className="p-3 bg-red-50 text-red-600 rounded-full">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Fallos</p>
                            <p className="text-xl font-bold text-gray-900">{selectedStudent.total_fallos || 0}</p>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-4 border-l-4 border-l-green-500">
                        <div className="p-3 bg-green-50 text-green-600 rounded-full">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Autonomía</p>
                            <p className="text-xl font-bold text-gray-900">{calculateAutonomy(selectedStudent)}%</p>
                        </div>
                    </Card>
                </div>
                {/* 3. CONTENIDO PRINCIPAL: 2 filas de 2 columnas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Fila 1 */}
                    <div className="space-y-6">
                        <Card className="h-full">
                            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <BarChart2 size={18} className="text-blue-600"/> Progreso por Tema
                            </h3>
                            <div className="space-y-5">
                                {TEMAS_JAVA.map(tema => {
                                    const data = progresoTemas[tema] || { nivel: 1, puntos: 0 };
                                    const porcentaje = Math.min((data.nivel / 5) * 100, 100);
                                    return (
                                        <div key={tema}>
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="font-medium text-gray-700">{tema}</span>
                                                <span className="text-gray-500 font-mono bg-gray-100 px-1.5 rounded">Lvl {data.nivel}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${getStatusColor(porcentaje)}`}
                                                    style={{ width: `${porcentaje}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1 text-right">{data.puntos} pts acumulados</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Search size={18} className="text-blue-600"/> Code Playback
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Historial de interacción reciente</p>
                            </div>
                            <div className="p-4 bg-slate-50 flex-1 max-h-[600px] overflow-y-auto space-y-4 custom-scrollbar">
                                {historial.length === 0 ? (
                                    <div className="text-center py-10 opacity-50">
                                        <p>No hay historial disponible.</p>
                                    </div>
                                ) : (
                                    historial.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.usuario ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-3 rounded-2xl text-sm max-w-[90%] shadow-sm ${
                                                msg.usuario
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                            }`}>
                                                <p className={`text-[9px] font-bold mb-1 uppercase tracking-wider ${
                                                    msg.usuario ? 'text-blue-200' : 'text-gray-400'
                                                }`}>
                                                    {msg.usuario ? 'Estudiante' : 'LogicBot'}
                                                </p>
                                                <pre className={`whitespace-pre-wrap font-mono text-xs overflow-x-auto p-2 rounded ${
                                                    msg.usuario ? 'bg-blue-700/50' : 'bg-gray-100'
                                                }`}>
                                {msg.usuario || msg.bot}
                              </pre>
                                            </div>
                                        </div>
                                    )))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Fila 2 */}
                    <div className="space-y-6">
                        <Card className="border-t-4 border-t-red-500 h-full flex flex-col">
                            <div className="mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                                    <FileText className="text-red-500"/> Historial de Reportes
                                </h3>
                                <p className="text-xs text-gray-500">Hoja de vida de integridad académica.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 max-h-[600px] custom-scrollbar">
                                <AlertList filteredAlerts={studentAlerts} showStudentName={false} />
                            </div>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card className="h-full flex flex-col border-t-4 border-t-blue-500">
                            <HistoryList studentLogs={studentLogs} />
                        </Card>
                    </div>
                </div>
            </div>
        );
    };

    // ESTADO DE CARGA GLOBAL
    if (loading && !students.length && !classes.length) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 font-medium animate-pulse">Conectando con LogicBot Core...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
            {/* Navbar Principal */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-sm backdrop-blur-md bg-white/80">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                            LogicBot <span className="text-blue-600">Torre de Control</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 font-medium tracking-wide">PANEL DOCENTE</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {/* 🔔 BOTÓN DE NOTIFICACIONES */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full transition relative"
                        >
                            <Bell size={22} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                            )}
                        </button>
                        {/* Panel Dropdown */}
                        {showAlertsPanel && <AlertsDropdown />}
                    </div>

                    <div className="hidden md:block text-right border-r border-gray-200 pr-6">
                        <p className="text-sm font-bold text-gray-800">Profesor Demo</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> En línea
                        </p>
                    </div>
                    <button
                        onClick={() => auth.signOut()}
                        className="group p-2 text-gray-400 hover:text-red-500 transition rounded-full hover:bg-red-50"
                        title="Cerrar Sesión"
                    >
                        <LogOut size={20} className="group-hover:translate-x-1 transition" />
                    </button>
                </div>
            </nav>

            {/* Contenido Principal */}
            <main className="max-w-7xl mx-auto p-6 md:p-8">
                {view === 'classes' && renderClassList()}
                {view === 'dashboard' && renderClassDashboard()}
                {view === 'student' && renderStudentDetail()}
            </main>

            {/* Modal Crear Clase */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 scale-100">
                        <h3 className="text-2xl font-bold mb-2 text-gray-900">Nueva Clase</h3>
                        <p className="text-gray-500 text-sm mb-6">Generaremos un Token único para que tus alumnos se vinculen.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nombre de la Asignatura</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900"
                                    placeholder="Ej. Fundamentos de Java - Grupo A"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateClass}
                                disabled={!newClassName.trim()}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-600/20"
                            >
                                Crear Clase
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

