/**
 * Estado global de la app: sesión, datos descargados de la API, aviso visible y selección activa
 * (cliente, semana y bloque abiertos). Las pantallas lo leen con useApp().
 */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  apiFetch,
  fetchPublicConfig,
  friendlyError,
  listenLiveChanges,
  refreshSession,
  serverLogout,
  setAccessToken,
  setSessionRenewedHandler,
} from '../api/client';
import {
  AuthResponse,
  Client,
  Idea,
  IdeaProposal,
  IdeaSection,
  Notification,
  PendingConfirmation,
  PlatformIntegrations,
  PlatformSettings,
  PublicConfig,
  Schedule,
  Session,
} from '../api/types';

/** Nombres de las pestañas del menú inferior. */
export type TabName = 'schedules' | 'ideas' | 'accounts' | 'proposals' | 'history' | 'settings';

/** Ruta de cada pestaña (ver src/app/(tabs)). El cronograma es la pantalla inicial. */
const TAB_PATHS: Record<TabName, string> = {
  schedules: '/',
  ideas: '/ideas',
  accounts: '/accounts',
  proposals: '/proposals',
  history: '/history',
  settings: '/settings',
};

/** Datos con los que se abre el editor de bloques. */
export interface BlockEditorSeed {
  blockId: string | null;
  day: number;
  title?: string;
  notes?: string;
  color?: string;
}

interface AppData {
  clients: Client[];
  schedules: Schedule[];
  notifications: Notification[];
  ideaProposals: IdeaProposal[];
  ideaSections: IdeaSection[];
  ideas: Idea[];
  pendingConfirmation: PendingConfirmation | null;
}

const EMPTY_DATA: AppData = {
  clients: [],
  schedules: [],
  notifications: [],
  ideaProposals: [],
  ideaSections: [],
  ideas: [],
  pendingConfirmation: null,
};

interface Banner {
  msg: string;
  isErr: boolean;
}

interface AppValue extends AppData {
  booting: boolean;
  config: PublicConfig;
  appName: string;
  session: Session | null;
  loadingData: boolean;
  banner: Banner | null;
  platformSettings: PlatformSettings | null;
  platformIntegrations: PlatformIntegrations | null;
  selectedClientId: string | null;
  selectedScheduleId: string | null;
  inspectBlockId: string | null;
  blockEditor: BlockEditorSeed | null;
  ideaSectionFilter: string;
  setBanner: (msg: string, isErr?: boolean) => void;
  clearBanner: () => void;
  hydrate: (opts?: { silent?: boolean }) => Promise<void>;
  applyServerSession: (data: AuthResponse, welcome?: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
  updateSession: (patch: Partial<Session>) => void;
  setPlatform: (settings: PlatformSettings, integrations: PlatformIntegrations) => void;
  setConfig: (patch: PublicConfig) => void;
  selectClient: (clientId: string) => void;
  selectSchedule: (scheduleId: string) => void;
  setInspectBlockId: (blockId: string | null) => void;
  openBlockEditor: (seed: BlockEditorSeed | null) => void;
  setIdeaSectionFilter: (filter: string) => void;
  patchBlockLocally: (blockId: string, patch: Record<string, unknown>) => void;
  goToTab: (tab: TabName) => void;
}

const AppContext = createContext<AppValue | null>(null);

const SESSION_HINT = 'cs_has_session';
// Los avisos de éxito se van solos rápido; los de error quedan más tiempo para poder leerlos.
const BANNER_MS = 3500;
const BANNER_ERROR_MS = 7000;
const MEDIA_URL_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Convierte el usuario que envía la API en la sesión de la app. */
function sessionFromUser(user: AuthResponse['user']): Session {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName || user.email,
    role: user.role,
    agencyId: user.agencyId || null,
    agencyName: user.agencyName || '',
    needsProfileSetup: Boolean(user.needsProfileSetup),
    clientId: user.clientId || null,
  };
}

/** Adapta un cliente de la API al formato que usa la interfaz. */
function normalizeClient(c: any): Client {
  return {
    id: c.id,
    agencyId: c.agencyId,
    agencyName: c.agency?.name || 'Agencia',
    companyName: c.companyName,
    industry: c.industry || 'Marca',
    confirmationStatus: c.confirmationStatus || 'CONFIRMED',
    confirmedAt: c.confirmedAt,
    contactFullName: c.user?.fullName || 'Contacto',
    contactEmail: c.user?.email || '',
  };
}

/** Resume los datos para saber si cambiaron. Los enlaces firmados se ignoran: cambian en cada carga. */
function fingerprintOf(results: { ok: boolean; data: unknown }[]) {
  return JSON.stringify(
    results.map((r) => (r.ok ? r.data : null)),
    (key, value) => (/url/i.test(key) ? undefined : value),
  );
}

/** Provee el estado global a toda la app. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [config, setConfigState] = useState<PublicConfig>({});
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loadingData, setLoadingData] = useState(false);
  const [banner, setBannerState] = useState<Banner | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [platformIntegrations, setPlatformIntegrations] = useState<PlatformIntegrations | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [inspectBlockId, setInspectBlockId] = useState<string | null>(null);
  const [blockEditor, setBlockEditor] = useState<BlockEditorSeed | null>(null);
  const [ideaSectionFilter, setIdeaSectionFilter] = useState('ALL');

  const sessionRef = useRef<Session | null>(null);
  const fingerprintRef = useRef<string | null>(null);
  const mediaUrls = useRef(new Map<string, { url: string; at: number }>());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selection = useRef({ clientId: null as string | null, scheduleId: null as string | null });
  const dataRef = useRef<AppData>(EMPTY_DATA);
  // Las funciones asíncronas leen los valores más recientes desde estas referencias.
  useLayoutEffect(() => {
    sessionRef.current = session;
    dataRef.current = data;
    selection.current = { clientId: selectedClientId, scheduleId: selectedScheduleId };
  });

  const setBanner = useCallback((msg: string, isErr = false) => {
    setBannerState({ msg, isErr });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBannerState(null), isErr ? BANNER_ERROR_MS : BANNER_MS);
  }, []);

  const clearBanner = useCallback(() => setBannerState(null), []);

  const goToTab = useCallback((tab: TabName) => {
    router.navigate(TAB_PATHS[tab] as any);
  }, []);

  /** Reusa los enlaces de archivos todavía vigentes para no volver a descargar fotos y videos. */
  const reuseMediaUrls = useCallback((schedules: Schedule[]) => {
    const now = Date.now();
    schedules.forEach((s) =>
      (s.items || []).forEach((item) =>
        (item.media || []).forEach((m) => {
          const cached = mediaUrls.current.get(m.storageKey);
          if (cached && now - cached.at < MEDIA_URL_MAX_AGE_MS) m.url = cached.url;
          else if (m.url) mediaUrls.current.set(m.storageKey, { url: m.url, at: now });
        }),
      ),
    );
  }, []);

  /** Elige el cliente y la semana por defecto cuando no hay uno válido seleccionado. */
  const fixSelection = useCallback((clients: Client[], schedules: Schedule[]) => {
    const confirmed = clients.filter((c) => c.confirmationStatus === 'CONFIRMED');
    let clientId = selection.current.clientId;
    if (!clientId || !confirmed.some((c) => c.id === clientId)) {
      clientId = confirmed[0]?.id || clients[0]?.id || null;
    }
    const clientSchedules = schedules.filter((s) => s.clientId === clientId);
    let scheduleId = selection.current.scheduleId;
    if (!clientSchedules.some((s) => s.id === scheduleId)) scheduleId = clientSchedules[0]?.id || null;
    setSelectedClientId(clientId);
    setSelectedScheduleId(scheduleId);
  }, []);

  const logout = useCallback(
    async (message = 'Cerraste sesión correctamente.') => {
      void serverLogout();
      setAccessToken(null);
      setSession(null);
      setData(EMPTY_DATA);
      setInspectBlockId(null);
      setBlockEditor(null);
      fingerprintRef.current = null;
      await AsyncStorage.removeItem(SESSION_HINT).catch(() => {});
      setBanner(message);
    },
    [setBanner],
  );

  /** Descarga todos los datos que corresponden al rol del usuario. */
  const hydrate = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const current = sessionRef.current;
      if (!current) return;
      if (!silent) setLoadingData(true);
      const role = current.role;
      const calls = [
        apiFetch('/clients/pending-confirmation'),
        apiFetch('/clients'),
        apiFetch('/schedules'),
        apiFetch('/notifications'),
        apiFetch('/idea-proposals'),
      ];
      if (role !== 'CLIENTE') calls.push(apiFetch('/ideas/sections'), apiFetch('/ideas'));
      const results = await Promise.all(calls);
      if (sessionRef.current?.id !== current.id) return;
      const [pend, cl, sch, not, prop, sec, ideas] = results;

      if (cl.status === 401 && sch.status === 401) {
        setLoadingData(false);
        await logout('Tu sesión expiró. Volvé a iniciar sesión.');
        return;
      }

      const fingerprint = fingerprintOf(results);
      if (silent && fingerprint === fingerprintRef.current) return;
      fingerprintRef.current = fingerprint;

      // Si una consulta falla (por ejemplo, sin señal), se conserva lo que ya había.
      const prev = dataRef.current;
      const list = <T,>(r: { ok: boolean; data: any } | undefined, fallback: T[], map?: (x: any) => T): T[] =>
        r?.ok && Array.isArray(r.data) ? (map ? r.data.map(map) : r.data) : fallback;
      const next: AppData = {
        pendingConfirmation: pend.ok ? pend.data?.pendingClient || null : prev.pendingConfirmation,
        clients: list(cl, prev.clients, normalizeClient),
        schedules: list(sch, prev.schedules),
        notifications: list(not, prev.notifications),
        ideaProposals: list(prop, prev.ideaProposals),
        ideaSections: list(sec, prev.ideaSections),
        ideas: list(ideas, prev.ideas),
      };
      reuseMediaUrls(next.schedules);
      setData(next);
      fixSelection(next.clients, next.schedules);
      setLoadingData(false);
    },
    [fixSelection, logout, reuseMediaUrls],
  );

  /** Abre la sesión con la respuesta del servidor y descarga los datos. */
  const applyServerSession = useCallback(
    async (res: AuthResponse, welcome?: string) => {
      setAccessToken(res.accessToken);
      const s = sessionFromUser(res.user);
      sessionRef.current = s;
      setSession(s);
      await AsyncStorage.setItem(SESSION_HINT, '1').catch(() => {});
      setBanner(welcome || `Hola, ${String(s.fullName).split(' ')[0]}. Tu espacio está sincronizado.`);
      await hydrate();
    },
    [hydrate, setBanner],
  );

  // Al abrir la app: lee la configuración y, si había una sesión, la recupera con la cookie.
  useEffect(() => {
    setSessionRenewedHandler((res) => {
      const s = sessionFromUser(res.user);
      sessionRef.current = s;
      setSession(s);
    });
    (async () => {
      setConfigState(await fetchPublicConfig());
      const hint = await AsyncStorage.getItem(SESSION_HINT).catch(() => null);
      if (hint === '1' && (await refreshSession())) {
        await hydrate();
      } else if (hint === '1') {
        await AsyncStorage.removeItem(SESSION_HINT).catch(() => {});
      }
      setBooting(false);
    })();
    return () => setSessionRenewedHandler(null);
  }, [hydrate]);

  // Tiempo real: el servidor avisa que algo cambió y los datos se actualizan solos.
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const request = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void hydrate({ silent: true }), 400);
    };
    const stop = listenLiveChanges(request);
    // Por si el canal no está disponible.
    const poll = setInterval(request, 30000);
    // Al volver a la app se trae lo último: la otra parte pudo haber respondido.
    const sub = AppState.addEventListener('change', (stateName) => {
      if (stateName === 'active') request();
    });
    return () => {
      stop();
      clearInterval(poll);
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, hydrate]);

  const value = useMemo<AppValue>(
    () => ({
      ...data,
      booting,
      config,
      appName: config.appName || 'ContentSync',
      session,
      loadingData,
      banner,
      platformSettings,
      platformIntegrations,
      selectedClientId,
      selectedScheduleId,
      inspectBlockId,
      blockEditor,
      ideaSectionFilter,
      setBanner,
      clearBanner,
      hydrate,
      applyServerSession,
      logout,
      updateSession: (patch) =>
        setSession((prev) => {
          const next = prev ? { ...prev, ...patch } : prev;
          sessionRef.current = next;
          return next;
        }),
      setPlatform: (settings, integrations) => {
        setPlatformSettings(settings);
        setPlatformIntegrations(integrations);
        setConfigState((prev) => ({ ...prev, appName: settings.appName, registrationEnabled: settings.registrationEnabled }));
      },
      setConfig: (patch) => setConfigState((prev) => ({ ...prev, ...patch })),
      selectClient: (clientId) => {
        setSelectedClientId(clientId);
        const first = data.schedules.find((s) => s.clientId === clientId);
        setSelectedScheduleId(first?.id || null);
      },
      selectSchedule: setSelectedScheduleId,
      setInspectBlockId,
      openBlockEditor: setBlockEditor,
      setIdeaSectionFilter,
      patchBlockLocally: (blockId, patch) =>
        setData((prev) => ({
          ...prev,
          schedules: prev.schedules.map((s) => ({
            ...s,
            items: (s.items || []).map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
          })),
        })),
      goToTab,
    }),
    [
      data,
      booting,
      config,
      session,
      loadingData,
      banner,
      platformSettings,
      platformIntegrations,
      selectedClientId,
      selectedScheduleId,
      inspectBlockId,
      blockEditor,
      ideaSectionFilter,
      setBanner,
      clearBanner,
      hydrate,
      applyServerSession,
      logout,
      goToTab,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Devuelve el estado global. */
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp debe usarse dentro de AppProvider.');
  return value;
}

/**
 * Ejecuta una acción contra la API con el patrón de siempre: si falla muestra el error,
 * y si sale bien recarga los datos y muestra el mensaje de éxito.
 */
export function useApiAction() {
  const { setBanner, hydrate } = useApp();
  return useCallback(
    async (path: string, options: { method?: string; body?: unknown }, success?: string) => {
      const r = await apiFetch(path, options);
      if (!r.ok) {
        setBanner(friendlyError(r.data, r.status), true);
        return null;
      }
      await hydrate();
      if (success) setBanner(success);
      return r.data;
    },
    [setBanner, hydrate],
  );
}
