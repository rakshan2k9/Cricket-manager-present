import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';
import { DrizzleStore } from './drizzleStore';
import {
  auctions,
  leagueMembers,
  leagues,
  managerProfiles,
  playerContracts,
  players,
  teams,
  users,
} from './schema';

function tempDbPath(name: string) {
  return path.join(os.tmpdir(), `cm27-test-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

test('DrizzleStore persists users, profiles, leagues, joins, and survives reload', async () => {
  const file = tempDbPath('persist');
  try {
    const store1 = new DrizzleStore({ persistPath: file, enableFirestoreSync: false });
    const db1 = store1.createDbClient();

    const [u1] = await db1
      .insert(users)
      .values({ uid: 'uid-1', email: 'mgr@example.com' })
      .onConflictDoUpdate({ target: users.uid, set: { email: 'mgr2@example.com' } })
      .returning();
    assert.equal(u1.uid, 'uid-1');

    const [u1Updated] = await db1
      .insert(users)
      .values({ uid: 'uid-1', email: 'mgr-final@example.com' })
      .onConflictDoUpdate({ target: users.uid, set: { email: 'mgr-final@example.com' } })
      .returning();
    assert.equal(u1Updated.id, u1.id);
    assert.equal(u1Updated.email, 'mgr-final@example.com');

    await db1
      .insert(managerProfiles)
      .values({
        userUid: 'uid-1',
        managerName: 'Rakshan',
        country: 'India',
        favoriteFormat: 'T20',
        avatarUrl: 'crest:emerald',
      })
      .returning();

    const [league] = await db1
      .insert(leagues)
      .values({
        name: 'Premier Dynasty',
        inviteCode: 'TEST01',
        hostUid: 'uid-1',
        primaryCompetition: 'IPL',
      })
      .returning();

    await db1.insert(leagueMembers).values({
      leagueId: league.id,
      userUid: 'uid-1',
      role: 'host',
    });

    await db1.insert(teams).values([
      {
        leagueId: league.id,
        ownerUid: 'uid-1',
        name: 'Royal Challengers',
        shortCode: 'RCB',
        homeGround: 'Chinnaswamy',
      },
      {
        leagueId: league.id,
        ownerUid: null,
        name: 'Mumbai Indians',
        shortCode: 'MI',
        homeGround: 'Wankhede',
      },
    ]);

    const joined = await db1
      .select({ league: leagues, role: leagueMembers.role })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
      .where(eq(leagueMembers.userUid, 'uid-1'))
      .orderBy(desc(leagues.createdAt));

    assert.equal(joined.length, 1);
    assert.equal(joined[0].league.name, 'Premier Dynasty');
    assert.equal(joined[0].role, 'host');

    const aiTeams = await db1
      .select()
      .from(teams)
      .where(and(eq(teams.leagueId, league.id), sql`owner_uid IS NULL`));
    assert.equal(aiTeams.length, 1);
    assert.equal(aiTeams[0].shortCode, 'MI');

    // Reload from disk into a fresh store
    const store2 = new DrizzleStore({ persistPath: file, enableFirestoreSync: false });
    const db2 = store2.createDbClient();
    const reloadedLeagues = await db2.select().from(leagues).where(eq(leagues.inviteCode, 'TEST01'));
    assert.equal(reloadedLeagues.length, 1);
    assert.equal(reloadedLeagues[0].id, league.id);
    assert.ok(reloadedLeagues[0].createdAt instanceof Date);

    // Serial counter continues past reloaded max ID
    const [league2] = await db2
      .insert(leagues)
      .values({
        name: 'Second League',
        inviteCode: 'TEST02',
        hostUid: 'uid-1',
      })
      .returning();
    assert.equal(league2.id, league.id + 1);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

test('DrizzleStore supports ilike, inArray, notInArray, FOR UPDATE, rollback, and cascades', async () => {
  const file = tempDbPath('ops');
  try {
    const store = new DrizzleStore({ persistPath: file, enableFirestoreSync: false });
    const db = store.createDbClient();

    await db.insert(users).values({ uid: 'host-1', email: 'h@example.com' });
    const [lg] = await db
      .insert(leagues)
      .values({ name: 'Test League', inviteCode: 'OPS123', hostUid: 'host-1' })
      .returning();

    const [t1] = await db
      .insert(teams)
      .values({
        leagueId: lg.id,
        ownerUid: null,
        name: 'Yorkshire',
        shortCode: 'YOR',
        homeGround: 'Headingley',
        remainingBudget: 9500,
      })
      .returning();

    const insertedPlayers = await db
      .insert(players)
      .values([
        {
          leagueId: lg.id,
          name: 'Virat Kohli',
          country: 'India',
          age: 35,
          battingHand: 'Right',
          bowlingStyle: 'Right-arm medium',
          primaryRole: 'Batsman',
          battingRating: 94,
          bowlingRating: 20,
          fieldingRating: 88,
          fitness: 95,
          consistency: 92,
          temperament: 90,
          potential: 94,
          currentForm: 86,
          morale: 85,
          statsJson: {
            t20: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
            odi: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
            test: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
          },
        },
        {
          leagueId: lg.id,
          name: 'Jasprit Bumrah',
          country: 'India',
          age: 30,
          battingHand: 'Right',
          bowlingStyle: 'Right-arm fast',
          primaryRole: 'Bowler',
          battingRating: 25,
          bowlingRating: 96,
          fieldingRating: 80,
          fitness: 90,
          consistency: 95,
          temperament: 94,
          potential: 96,
          currentForm: 90,
          morale: 88,
          statsJson: {
            t20: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
            odi: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
            test: { matches: 0, runs: 0, battingAvg: 0, strikeRate: 0, hundreds: 0, fifties: 0, wickets: 0, economy: 0, bowlingAvg: 0, bestBowling: '0/0' },
          },
        },
      ])
      .returning();

    const search = await db
      .select()
      .from(players)
      .where(
        and(
          eq(players.leagueId, lg.id),
          ilike(players.name, '%kohli%'),
          gte(players.battingRating, 90),
          lte(players.age, 40)
        )
      );
    assert.equal(search.length, 1);
    assert.equal(search[0].name, 'Virat Kohli');

    const emptyIn = await db.select().from(players).where(inArray(players.id, []));
    assert.equal(emptyIn.length, 0);

    const notIn = await db
      .select()
      .from(players)
      .where(and(eq(players.leagueId, lg.id), notInArray(players.id, [insertedPlayers[0].id])));
    assert.equal(notIn.length, 1);
    assert.equal(notIn[0].name, 'Jasprit Bumrah');

    const lockedRes = await db.execute(
      sql`SELECT * FROM teams WHERE id = ${t1.id} AND league_id = ${lg.id} FOR UPDATE`
    );
    assert.equal(lockedRes.rows.length, 1);
    assert.equal(lockedRes.rows[0].short_code, 'YOR');
    assert.equal(lockedRes.rows[0].remaining_budget, 9500);

    // Transaction rollback test
    await assert.rejects(
      db.transaction(async (tx: any) => {
        await tx.update(teams).set({ remainingBudget: 100 }).where(eq(teams.id, t1.id));
        throw new Error('force rollback');
      }),
      /force rollback/
    );
    const [afterRollback] = await db.select().from(teams).where(eq(teams.id, t1.id));
    assert.equal(afterRollback.remainingBudget, 9500);

    // Double leftJoin (players -> playerContracts -> teams) and selectDistinct test
    const joinedPlayers = await db
      .select({
        player: players,
        contractTeamId: playerContracts.teamId,
        teamName: teams.name,
      })
      .from(players)
      .leftJoin(playerContracts, eq(players.id, playerContracts.playerId))
      .leftJoin(teams, eq(playerContracts.teamId, teams.id))
      .where(eq(players.leagueId, lg.id));
    assert.equal(joinedPlayers.length, 2);
    assert.equal(joinedPlayers[0].contractTeamId, null);
    assert.equal(joinedPlayers[0].teamName, null);

    const distinctCountries = await db
      .selectDistinct({ country: players.country })
      .from(players)
      .where(eq(players.leagueId, lg.id));
    assert.equal(distinctCountries.length, 1);
    assert.equal(distinctCountries[0].country, 'India');

    // Cascade delete test
    await db.insert(auctions).values({ leagueId: lg.id, status: 'lobby' });
    await db.delete(leagues).where(eq(leagues.id, lg.id));
    assert.equal((await db.select().from(teams)).length, 0);
    assert.equal((await db.select().from(players)).length, 0);
    assert.equal((await db.select().from(auctions)).length, 0);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
