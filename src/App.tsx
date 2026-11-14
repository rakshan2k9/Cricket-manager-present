import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLeagueRealtime } from './hooks/useLeagueRealtime';
import { useGlobalSocial } from './hooks/useGlobalSocial';
import { apiFetch } from './lib/api';
import type { League } from './types/game';
import { LoginView } from './views/LoginView';
import { ManagerProfileSetupView } from './views/ManagerProfileSetupView';
import { TitleMenuView } from './views/TitleMenuView';
import { LeagueLobbyView } from './views/LeagueLobbyView';
import { DashboardView } from './views/DashboardView';
import { InboxView } from './views/InboxView';
import { FriendsView } from './views/FriendsView';
import { FranchisesView } from './views/FranchisesView';
import { PlayerDatabaseView } from './views/PlayerDatabaseView';
import { SquadView } from './views/SquadView';
import { MatchdayView } from './views/MatchdayView';
import { AuctionRoomView } from './views/AuctionRoomView';
import { ScoutingView } from './views/ScoutingView';
import { TrainingGroundView } from './views/TrainingGroundView';
import { TransferMarketView } from './views/TransferMarketView';
import { GazetteView } from './views/GazetteView';
import { LeagueChatView } from './views/LeagueChatView';
import { ProfileSettingsView } from './views/ProfileSettingsView';
import { AppShell, type ActiveTab } from './components/AppShell';
import { ToastBar } from './components/ToastBar';
import { LoadingScreen } from './components/LoadingScreen';
import { isAutostartDemo } from './utils/demoLeagueState';
import { auth } from './lib/firebase';

function CricketManagerApp() {
  const { user, profile, loading: authLoading } = useAuth();
  const autostartDemo = isAutostartDemo();
  const [bootSplash, setBootSplash] = useState(!autostartDemo);
  const [enteringLeague, setEnteringLeague] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState<number | null>(autostartDemo ? 1 : null);
  const [entryScreen, setEntryScreen] = useState<'title' | 'lobby' | 'friends' | 'settings'>('title');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [inspectTeamId, setInspectTeamId] = useState<number | null>(null);
  const [userLeagues, setUserLeagues] = useState<League[]>([]);

  useEffect(() => {
    if (autostartDemo) return;
    const timer = setTimeout(() => setBootSplash(false), 1150);
    return () => clearTimeout(timer);
  }, [autostartDemo]);

  const loadUserLeagues = useCallback(async () => {
    if (!user || !profile || (autostartDemo && !auth.currentUser)) return;
    try {
      const data = await apiFetch<{ leagues: League[] }>('/api/leagues');
      setUserLeagues(data.leagues || []);
    } catch {
      // silent fallback
    }
  }, [user, profile, autostartDemo]);

  useEffect(() => {
    if (user && profile && !activeLeagueId) {
      loadUserLeagues();
    }
  }, [user, profile, activeLeagueId, loadUserLeagues]);

  const handleLeagueDeleted = useCallback(
    (payload: { leagueId: number; leagueName?: string }) => {
      loadUserLeagues();
      setActiveLeagueId((curr) => {
        if (curr === payload?.leagueId) {
          setEntryScreen('lobby');
          return null;
        }
        return curr;
      });
    },
    [loadUserLeagues]
  );

  const {
    state,
    loading: leagueLoading,
    error: leagueError,
    wsConnected,
    clockOffsetMs,
    toasts,
    pushToast,
    dismissToast,
    squadVersion,
    playersVersion,
    refreshState,
  } = useLeagueRealtime(activeLeagueId, handleLeagueDeleted, user?.uid);

  const globalSocial = useGlobalSocial(Boolean(user && profile), pushToast, handleLeagueDeleted);
  const unreadSocialCount =
    globalSocial.friends.incoming.length + globalSocial.friends.totalUnread;

  const pushTypedToast = useCallback(
    (t: { type: 'success' | 'error' | 'info'; title: string; detail?: string }) => {
      pushToast({ tone: t.type, title: t.title, body: t.detail });
    },
    [pushToast]
  );

  const handleSelectLeague = (id: number) => {
    setEnteringLeague(true);
    setActiveLeagueId(id);
    setActiveTab('dashboard');
    setInspectTeamId(null);
    setTimeout(() => setEnteringLeague(false), 750);
  };

  if (bootSplash || authLoading) {
    return (
      <LoadingScreen
        message={
          authLoading
            ? 'Authenticating Manager Credentials...'
            : 'Initializing Cricket Manager 27 (CM27)...'
        }
        sublabel="Loading Operations Core & Persistent World Sync"
      />
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (!profile) {
    return <ManagerProfileSetupView />;
  }

  if (!activeLeagueId) {
    if (entryScreen === 'settings') {
      return (
        <div className="min-h-screen bg-[#0D1014] p-6 sm:p-10 flex justify-center">
          <div className="w-full max-w-4xl">
            <ProfileSettingsView
              onToast={(t) => pushToast(t)}
              onBackToLobby={() => setEntryScreen('title')}
            />
            <ToastBar toasts={toasts} onDismiss={dismissToast} />
          </div>
        </div>
      );
    }

    if (entryScreen === 'title') {
      return (
        <>
          <TitleMenuView
            leagues={userLeagues}
            unreadSocialCount={unreadSocialCount}
            onPlay={() => setEntryScreen('lobby')}
            onContinueLeague={handleSelectLeague}
            onOpenSettings={() => setEntryScreen('settings')}
            onOpenFriends={() => setEntryScreen('friends')}
          />
          <ToastBar toasts={toasts} onDismiss={dismissToast} />
        </>
      );
    }

    return (
      <>
        <LeagueLobbyView
          initialTab={entryScreen === 'friends' ? 'friends' : 'home'}
          social={globalSocial}
          onSelectLeague={handleSelectLeague}
          onOpenAccountSettings={() => setEntryScreen('settings')}
          onBackToTitle={() => setEntryScreen('title')}
          onLeaguesUpdated={loadUserLeagues}
          onToast={(t) => pushToast(t)}
        />
        <ToastBar toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (enteringLeague || (leagueLoading && !state)) {
    return (
      <LoadingScreen
        message="Synchronizing League World & Auction Floor..."
        sublabel="Hydrating Competition Clubs, Verified Real Players, and Live WebSocket Sync"
      />
    );
  }

  if (leagueError && !state) {
    return (
      <div className="min-h-screen bg-[#0D1014] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-sm text-rose-400">{leagueError}</p>
        <button
          onClick={() => {
            setActiveLeagueId(null);
            setEntryScreen('lobby');
          }}
          className="px-4 py-2 rounded cm27-btn-3d font-semibold text-xs cursor-pointer"
        >
          Return to League Hub
        </button>
      </div>
    );
  }

  if (!state) return null;

  const handleInspectTeam = (teamId: number) => {
    setInspectTeamId(teamId);
    setActiveTab('squad');
  };

  return (
    <>
      <AppShell
        state={state}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== 'squad') setInspectTeamId(null);
          setActiveTab(tab);
        }}
        onBackToLobby={() => {
          setActiveLeagueId(null);
          setEntryScreen('lobby');
        }}
        wsConnected={wsConnected}
        onRefreshState={refreshState}
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            state={state}
            onNavigate={setActiveTab}
            onInspectTeam={handleInspectTeam}
            onRefreshState={refreshState}
          />
        )}
        {activeTab === 'inbox' && (
          <InboxView
            state={state}
            onRefreshState={refreshState}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'friends' && (
          <FriendsView
            state={state}
            currentUid={user.uid}
            social={globalSocial}
            leagues={userLeagues}
            onSelectLeague={handleSelectLeague}
            onNavigate={setActiveTab}
            onInspectTeam={handleInspectTeam}
            onSwitchLeague={() => {
              setActiveLeagueId(null);
              setEntryScreen('lobby');
            }}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'franchises' && (
          <FranchisesView
            state={state}
            onRefresh={refreshState}
            onInspectTeam={handleInspectTeam}
            onToast={pushTypedToast}
          />
        )}
        {activeTab === 'players' && (
          <PlayerDatabaseView
            state={state}
            playersVersion={playersVersion}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'squad' && (
          <SquadView
            state={state}
            initialTeamId={inspectTeamId}
            squadVersion={squadVersion}
            onToast={pushTypedToast}
            onRefreshLeague={refreshState}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'matchday' && (
          <MatchdayView
            state={state}
            onNavigate={setActiveTab}
            onRefreshState={refreshState}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'auction' && (
          <AuctionRoomView
            state={state}
            clockOffsetMs={clockOffsetMs}
            onToast={(t) => pushToast(t)}
            onRefreshLeague={refreshState}
          />
        )}
        {activeTab === 'scouts' && (
          <ScoutingView
            state={state}
            onRefreshState={refreshState}
            onToast={pushTypedToast}
          />
        )}
        {activeTab === 'training' && (
          <TrainingGroundView
            state={state}
            squadVersion={squadVersion}
            onRefreshState={refreshState}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'transfers' && (
          <TransferMarketView
            state={state}
            squadVersion={squadVersion}
            onRefreshState={refreshState}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'gazette' && (
          <GazetteView
            state={state}
            onRefreshState={refreshState}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'chat' && (
          <LeagueChatView
            state={state}
            currentUid={user.uid}
            onToast={(t) => pushToast(t)}
          />
        )}
        {activeTab === 'settings' && (
          <ProfileSettingsView
            leagueState={state}
            onNavigate={setActiveTab}
            onInspectTeam={handleInspectTeam}
            onRefreshState={refreshState}
            onOpenAuction={() => setActiveTab('auction')}
            onLeaveLeagueSuccess={() => {
              setActiveLeagueId(null);
              setEntryScreen('lobby');
              loadUserLeagues();
            }}
            onToast={(t) => pushToast(t)}
          />
        )}
      </AppShell>
      <ToastBar toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CricketManagerApp />
    </AuthProvider>
  );
}
