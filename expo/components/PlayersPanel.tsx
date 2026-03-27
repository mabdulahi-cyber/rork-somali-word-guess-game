import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Mic, MicOff, Crown, ChevronsDown, User } from 'lucide-react-native';
import type { Player, Team, Role } from '@/types/game';

interface PlayersPanelProps {
  players: Player[];
  currentPlayerId: string;
  onSwitchTeam: (team: Team) => void;
  onChangeRole: (role: Role) => void;
}

export function PlayersPanel({
  players,
  currentPlayerId,
  onSwitchTeam,
  onChangeRole,
}: PlayersPanelProps) {
  const safePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
  const redPlayers = safePlayers.filter((p) => p && p.team === 'red');
  const bluePlayers = safePlayers.filter((p) => p && p.team === 'blue');
  const spectators = safePlayers.filter((p) => p && (!p.team || p.role === 'spectator'));

  const currentPlayer = safePlayers.find((p) => p && p.id === currentPlayerId) || null;

  const renderPlayerItem = (player: Player) => {
    if (!player || !player.id || !player.name) return null;
    
    const isMe = player.id === currentPlayerId;
    const isSpymaster = player.role === 'spymaster';

    return (
      <View key={player.id} style={styles.playerItem}>
        <View style={styles.playerInfo}>
          <View
            style={[
              styles.avatarConfig,
              { backgroundColor: player.team === 'red' ? '#ff6b6b' : player.team === 'blue' ? '#4ecdc4' : '#a0a0a0' },
            ]}
          >
             <User size={12} color="#16213e" />
          </View>
          <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
            {player.name} {isMe && '(You)'}
          </Text>
        </View>

        <View style={styles.playerBadges}>
          {isSpymaster && (
            <View style={styles.roleBadge}>
              <Crown size={10} color="#16213e" />
              <Text style={styles.roleBadgeText}>SPY</Text>
            </View>
          )}
          {player.micMuted ? (
            <MicOff size={14} color="#ff6b6b" />
          ) : (
            <Mic size={14} color="#4ecdc4" />
          )}
        </View>
      </View>
    );
  };

  const renderTeamColumn = (team: Team, teamPlayers: Player[]) => {
    if (!team || !Array.isArray(teamPlayers)) return null;
    
    const isRed = team === 'red';
    const teamColor = isRed ? '#ff6b6b' : '#4ecdc4';
    const teamName = isRed ? 'Red Team' : 'Blue Team';
    const spymaster = teamPlayers.filter(Boolean).find(p => p && p.role === 'spymaster');

    const isMyTeam = currentPlayer?.team === team;
    const amISpymaster = currentPlayer?.role === 'spymaster' && isMyTeam;
    const isSpectator = !currentPlayer?.team || currentPlayer?.role === 'spectator';

    return (
      <View style={[styles.teamColumn, { borderColor: `${teamColor}40` }]}>
        <View style={[styles.teamHeader, { backgroundColor: `${teamColor}20` }]}>
          <Text style={[styles.teamTitle, { color: teamColor }]}>{teamName}</Text>
          <Text style={[styles.teamCount, { color: teamColor }]}>{teamPlayers.length}</Text>
        </View>
        
        <ScrollView style={styles.teamList} nestedScrollEnabled>
          {Array.isArray(teamPlayers) && teamPlayers.length > 0 ? (
            teamPlayers.filter(Boolean).map(renderPlayerItem).filter(Boolean)
          ) : (
            <Text style={styles.emptyTeamText}>No players</Text>
          )}
        </ScrollView>

        <View style={styles.teamActions}>
          {isSpectator ? (
             <Pressable
              onPress={() => onSwitchTeam(team)}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: teamColor, backgroundColor: `${teamColor}15` },
                pressed && { backgroundColor: `${teamColor}30` }
              ]}
            >
              <Text style={[styles.actionButtonText, { color: teamColor }]}>Join {teamName}</Text>
            </Pressable>
          ) : !isMyTeam ? (
             <Pressable
              onPress={() => onSwitchTeam(team)}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: teamColor },
                pressed && { backgroundColor: `${teamColor}20` }
              ]}
            >
              <Text style={[styles.actionButtonText, { color: teamColor }]}>Switch to {teamName}</Text>
            </Pressable>
          ) : (
            <>
               {amISpymaster ? (
                  <Pressable
                    onPress={() => onChangeRole('guesser')}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.stepDownButton,
                      pressed && styles.stepDownButtonPressed
                    ]}
                  >
                    <ChevronsDown size={14} color="#ffd369" />
                    <Text style={styles.stepDownText}>Step Down</Text>
                  </Pressable>
               ) : (
                 <Pressable
                    onPress={() => onChangeRole('spymaster')}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.spymasterButton,
                      pressed && styles.spymasterButtonPressed
                    ]}
                  >
                    <Crown size={14} color="#16213e" />
                    <Text style={styles.spymasterButtonText}>
                       {spymaster ? 'Replace Spymaster' : 'Be Spymaster'}
                    </Text>
                  </Pressable>
               )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.teamsContainer}>
        {renderTeamColumn('red', redPlayers || [])}
        {renderTeamColumn('blue', bluePlayers || [])}
      </View>
      
      {Array.isArray(spectators) && spectators.length > 0 ? (
         <View style={styles.spectatorsSection}>
            <View style={styles.spectatorHeader}>
              <User size={16} color="#888" />
              <Text style={styles.spectatorsLabel}>Spectators ({spectators.length})</Text>
            </View>
            <View style={styles.spectatorsRow}>
              {spectators.filter(Boolean).map(p => (
                p && p.id && p.name ? (
                  <View key={p.id} style={[
                    styles.spectatorChip,
                    p.id === currentPlayerId && styles.spectatorChipMe
                  ]}>
                    <Text style={[
                      styles.spectatorName,
                      p.id === currentPlayerId && styles.spectatorNameMe
                    ]}>
                      {p.name}{p.id === currentPlayerId ? ' (You)' : ''}
                    </Text>
                  </View>
                ) : null
              ))}
            </View>
         </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  teamsContainer: {
    flexDirection: 'row',
    gap: 12,
    height: 220, // Fixed height for scrolling
  },
  teamColumn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  teamTitle: {
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  teamCount: {
    fontWeight: '700',
    fontSize: 12,
    opacity: 0.8,
  },
  teamList: {
    flex: 1,
    padding: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 6,
    borderRadius: 8,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarConfig: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  playerNameMe: {
    color: '#ffd369',
    fontWeight: '700',
  },
  playerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ffd369',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16213e',
  },
  emptyTeamText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  teamActions: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  spymasterButton: {
    backgroundColor: '#ffd369',
    borderColor: '#ffd369',
  },
  spymasterButtonPressed: {
    backgroundColor: '#f4c542',
  },
  spymasterButtonText: {
    color: '#16213e',
    fontSize: 12,
    fontWeight: '700',
  },
  stepDownButton: {
    backgroundColor: 'transparent',
    borderColor: '#ffd369',
  },
  stepDownButtonPressed: {
    backgroundColor: 'rgba(255, 211, 105, 0.1)',
  },
  stepDownText: {
    color: '#ffd369',
    fontSize: 12,
    fontWeight: '600',
  },
  spectatorsSection: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  spectatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  spectatorsLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spectatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  spectatorChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  spectatorChipMe: {
    backgroundColor: 'rgba(255, 211, 105, 0.15)',
    borderColor: 'rgba(255, 211, 105, 0.3)',
  },
  spectatorName: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '500',
  },
  spectatorNameMe: {
    color: '#ffd369',
    fontWeight: '600',
  },
});
