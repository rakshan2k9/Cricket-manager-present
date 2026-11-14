import { GoogleGenAI, Type } from '@google/genai';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  leagues,
  managerProfiles,
  matches,
  teams,
  type MatchResultSummary,
  type PressConferenceData,
  type PressConferenceQuestion,
  type PressConferenceQuoteOption,
} from '../db/schema.ts';
import { wsHub } from './wsHub.ts';

export interface PressConferenceContextInput {
  matchId: number;
  leagueName: string;
  competitionLabel: string;
  humanTeamId: number;
  humanTeamName: string;
  humanTeamShortCode: string;
  oppTeamName: string;
  oppTeamShortCode: string;
  managerName: string;
  summary: MatchResultSummary;
}

const IMPACT_TAG_BY_STANCE: Record<'measured' | 'assertive' | 'critical', string> = {
  measured: 'Squad Morale +2 · Board Reputation +1',
  assertive: 'Next-Match Press Edge · Sparks Rivalry',
  critical: 'Board Reputation +2 · Target Player Morale -8',
};

function extractMatchSignals(input: PressConferenceContextInput) {
  const { summary, humanTeamId } = input;
  const allBatters = [...(summary.innings1.batters || []), ...(summary.innings2.batters || [])];
  const allBowlers = [...(summary.innings1.bowlers || []), ...(summary.innings2.bowlers || [])];

  const myInn = summary.innings1.teamId === humanTeamId ? summary.innings1 : summary.innings2;
  const oppInn = summary.innings1.teamId === humanTeamId ? summary.innings2 : summary.innings1;

  const topScorer = [...allBatters].sort((a, b) => b.runs - a.runs)[0] || null;
  const myTopBatter = [...(myInn.batters || [])].sort((a, b) => b.runs - a.runs)[0] || topScorer;
  const myBowlers = [...(oppInn.bowlers || [])].filter((b) => parseFloat(b.overs) >= 1);
  const worstMyBowler =
    [...myBowlers].sort((a, b) => b.econ - a.econ || a.wickets - b.wickets)[0] ||
    [...allBowlers].sort((a, b) => b.econ - a.econ)[0] ||
    null;

  const myWon = summary.winnerTeamId === humanTeamId;
  const droppedCatches = summary.droppedCatches || [];
  const turningPoints = summary.turningPoints || [];

  return {
    myWon,
    myInn,
    oppInn,
    topScorer,
    myTopBatter,
    worstMyBowler,
    droppedCatches,
    turningPoints,
  };
}

function buildFallbackQuoteOptions(
  idx: number,
  input: PressConferenceContextInput,
  signals: ReturnType<typeof extractMatchSignals>,
  targetPlayerName?: string | null
): PressConferenceQuoteOption[] {
  const my = input.humanTeamShortCode;
  const opp = input.oppTeamShortCode;
  const topBat = signals.myTopBatter;
  const worstBowl = signals.worstMyBowler;
  const pitchShort = input.summary.pitchCondition.split('·')[0].trim().toLowerCase();

  if (idx === 0) {
    if (signals.myWon) {
      return [
        {
          stance: 'measured',
          quote: `${topBat ? `${topBat.name}'s ${topBat.runs} off ${topBat.balls} balls set the tempo,` : 'Our top order absorbed pressure well,'} and we take collective pride in executing our plans on a ${pitchShort} surface.`,
          impactTag: IMPACT_TAG_BY_STANCE.measured,
        },
        {
          stance: 'assertive',
          quote: `Posting ${signals.myInn.runs}/${signals.myInn.wickets} showed ${opp} that our batting group dictates terms in any conditions — we aren't taking a backward step all season.`,
          impactTag: IMPACT_TAG_BY_STANCE.assertive,
        },
        {
          stance: 'critical',
          quote: `Getting over the line doesn't mask that we left 15 runs out there through soft dismissals in the middle overs — our finishing standards must sharpen immediately.`,
          impactTag: IMPACT_TAG_BY_STANCE.critical,
        },
      ];
    }
    return [
      {
        stance: 'measured',
        quote: `Our middle-over rotation lacked intent against ${opp}, and we take collective responsibility for letting the required rate slip in ${my}'s innings.`,
        impactTag: IMPACT_TAG_BY_STANCE.measured,
      },
      {
        stance: 'assertive',
        quote: `Credit to ${opp} today, but one defeat won't rattle ${my}'s dressing room — our match-winners know how close this contest was and we want the return fixture already.`,
        impactTag: IMPACT_TAG_BY_STANCE.assertive,
      },
      {
        stance: 'critical',
        quote: `Honestly, collapsing to ${signals.myInn.runs}/${signals.myInn.wickets} with poor shot selection isn't acceptable for ${my}, and selection places have to be earned under pressure.`,
        impactTag: IMPACT_TAG_BY_STANCE.critical,
      },
    ];
  }

  if (idx === 1) {
    const bowlerLabel = targetPlayerName || worstBowl?.name || 'our seam unit';
    return [
      {
        stance: 'measured',
        quote: `${bowlerLabel} took on the toughest overs against set batters today; we back his skill set and will review the length charts calmly before our next session.`,
        impactTag: IMPACT_TAG_BY_STANCE.measured,
      },
      {
        stance: 'assertive',
        quote: `Chasing down targets or defending at ${input.summary.venue} tests nerve, and I'd back ${bowlerLabel} in the death overs over any rival attack in this competition.`,
        impactTag: IMPACT_TAG_BY_STANCE.assertive,
      },
      {
        stance: 'critical',
        quote: `At this level there's no hiding place — conceding ${worstBowl ? `${worstBowl.runs} runs at ${worstBowl.econ} an over` : 'free boundaries and half-chances'} costs matches, and accountability starts at training tomorrow.`,
        impactTag: IMPACT_TAG_BY_STANCE.critical,
      },
    ];
  }

  return [
    {
      stance: 'measured',
      quote: `The ${input.competitionLabel} table rewards composure over streaks; we'll bank the tactical learnings from ${input.summary.venue} and prepare methodically for the next round.`,
      impactTag: IMPACT_TAG_BY_STANCE.measured,
    },
    {
      stance: 'assertive',
      quote: `Every rival dugout watching tonight saw how dangerous ${my} looks when our core clicks — if ${opp} expects an easy rematch, they've misread this squad completely.`,
      impactTag: IMPACT_TAG_BY_STANCE.assertive,
    },
    {
      stance: 'critical',
      quote: `No one in the ${my} shirt gets a free pass on reputation alone — fielding standards and death execution have to lift 20 percent before the next team sheet goes in.`,
      impactTag: IMPACT_TAG_BY_STANCE.critical,
    },
  ];
}

function buildFallbackQuestions(input: PressConferenceContextInput): PressConferenceQuestion[] {
  const signals = extractMatchSignals(input);
  const { myWon, myInn, oppInn, myTopBatter, worstMyBowler, droppedCatches, turningPoints } =
    signals;

  const q1Target = myTopBatter;
  const q1 = myWon
    ? `${input.managerName}, ${input.humanTeamShortCode} sealed a statement result (${input.summary.marginText}) at ${input.summary.venue}. How crucial was ${q1Target ? `${q1Target.name}'s ${q1Target.runs} (${q1Target.balls}b)` : 'your top-order execution'} on a ${input.summary.pitchCondition.split('·')[0].trim()} surface?`
    : `${input.managerName}, ${input.humanTeamShortCode} fell short (${input.summary.marginText}) despite ${q1Target ? `${q1Target.name}'s ${q1Target.runs} runs` : 'fighting moments'}. Where did the tactical plan unravel against ${input.oppTeamShortCode}?`;

  const q2Target = worstMyBowler;
  const q2 =
    droppedCatches.length > 0
      ? `Fielding lapses proved expensive tonight — notably ${droppedCatches[0]}. Is dressing-room intensity dipping during high-pressure overs?`
      : q2Target && q2Target.econ >= 9.0
        ? `${q2Target.name} conceded ${q2Target.runs} runs at ${q2Target.econ} RPO in a tight contest. Do you back him to retain his role in the next fixture, or are bowling changes coming?`
        : `${oppInn.teamShortCode} posted ${oppInn.runs}/${oppInn.wickets} (${oppInn.overs} ov). Were you satisfied with your bowlers' execution in the death overs?`;

  const q3 =
    turningPoints.length > 0
      ? `With ${turningPoints[0]} shaping the contest and ${input.oppTeamShortCode} looming on the schedule, what message are you sending to rival dugouts ahead of the next round?`
      : `Looking ahead to the rest of the ${input.competitionLabel} campaign after ${myInn.runs}/${myInn.wickets} today, will ${input.humanTeamShortCode} play an even bolder brand of cricket?`;

  return [
    {
      id: `pc-${input.matchId}-1`,
      journalist: 'Vikram Deshmukh',
      outlet: 'CricWire Chronicle',
      question: q1,
      targetPlayerId: q1Target?.playerId ?? null,
      targetPlayerName: q1Target?.name ?? null,
      options: buildFallbackQuoteOptions(0, input, signals, q1Target?.name),
    },
    {
      id: `pc-${input.matchId}-2`,
      journalist: 'Eleanor Finch',
      outlet: 'The Pavilion Post',
      question: q2,
      targetPlayerId: q2Target?.playerId ?? null,
      targetPlayerName: q2Target?.name ?? null,
      options: buildFallbackQuoteOptions(1, input, signals, q2Target?.name),
    },
    {
      id: `pc-${input.matchId}-3`,
      journalist: 'Rohan Malhotra',
      outlet: 'Broadcast Desk Live',
      question: q3,
      targetPlayerId: null,
      targetPlayerName: null,
      options: buildFallbackQuoteOptions(2, input, signals, null),
    },
  ];
}

export async function generatePressConferenceQuestions(
  input: PressConferenceContextInput
): Promise<PressConferenceQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallbackQuestions(input);
  }

  const signals = extractMatchSignals(input);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const compactMatchPayload = {
    competition: input.competitionLabel,
    venue: input.summary.venue,
    pitch: input.summary.pitchCondition,
    result: input.summary.marginText,
    manOfTheMatch: input.summary.manOfTheMatch,
    humanClub: `${input.humanTeamName} (${input.humanTeamShortCode})`,
    opponentClub: `${input.oppTeamName} (${input.oppTeamShortCode})`,
    humanWon: signals.myWon,
    humanInnings: {
      team: signals.myInn.teamShortCode,
      score: `${signals.myInn.runs}/${signals.myInn.wickets} (${signals.myInn.overs} ov)`,
      topScorer: signals.myInn.topScorer,
      topBowler: signals.myInn.topBowler,
    },
    opponentInnings: {
      team: signals.oppInn.teamShortCode,
      score: `${signals.oppInn.runs}/${signals.oppInn.wickets} (${signals.oppInn.overs} ov)`,
      topScorer: signals.oppInn.topScorer,
      topBowler: signals.oppInn.topBowler,
    },
    notableDroppedCatches: signals.droppedCatches.slice(0, 2),
    turningPoints: signals.turningPoints.slice(0, 3),
    spotlightPlayers: [
      signals.myTopBatter
        ? {
            id: signals.myTopBatter.playerId,
            name: signals.myTopBatter.name,
            stat: `${signals.myTopBatter.runs} (${signals.myTopBatter.balls}b)`,
          }
        : null,
      signals.worstMyBowler
        ? {
            id: signals.worstMyBowler.playerId,
            name: signals.worstMyBowler.name,
            stat: `${signals.worstMyBowler.wickets}/${signals.worstMyBowler.runs} (econ ${signals.worstMyBowler.econ})`,
          }
        : null,
    ].filter(Boolean),
  };

  const prompt = `You are an ESPNcricinfo-grade cricket broadcast correspondent moderating a post-match press conference for head coach ${input.managerName} (${input.humanTeamName}).
Analyze this exact match JSON summary and generate 3 realistic questions AND 3 full-sentence spoken manager response quotes per question.
Rules:
- Question 1 focuses on batting/chasing/defending execution and exact scorelines.
- Question 2 probes a concrete tactical pressure point (dropped catch, expensive spell from spotlightPlayers, or death bowling) and sets targetPlayerId/targetPlayerName if applicable.
- Question 3 probes the tournament campaign, dressing-room mindset, or rivalry with ${input.oppTeamShortCode}.
- For EACH question, provide 3 realistic spoken first-person quotes the manager can say on camera:
  1) stance: "measured" — calm, process-driven, protective of the group.
  2) stance: "assertive" — confident, bold, challenging rival dugouts.
  3) stance: "critical" — candid accountability demanding higher execution standards.
- Do NOT write generic filler or single-word labels; every quote must reference real cricket specifics from this match JSON (runs, overs, pitch, catches, or player names).

MATCH SUMMARY:
${JSON.stringify(compactMatchPayload)}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            journalist: { type: Type.STRING },
            outlet: { type: Type.STRING },
            question: { type: Type.STRING },
            targetPlayerId: { type: Type.INTEGER, nullable: true },
            targetPlayerName: { type: Type.STRING, nullable: true },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stance: { type: Type.STRING },
                  quote: { type: Type.STRING },
                },
                required: ['stance', 'quote'],
              },
            },
          },
          required: ['journalist', 'outlet', 'question', 'options'],
        },
      },
    },
    required: ['questions'],
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.7,
      },
    });
    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.questions) && parsed.questions.length >= 3) {
        return parsed.questions.slice(0, 3).map((q: any, idx: number) => {
          const targetName = q.targetPlayerName ? String(q.targetPlayerName) : null;
          const fallbackOpts = buildFallbackQuoteOptions(idx, input, signals, targetName);
          const rawOpts = Array.isArray(q.options) ? q.options : [];
          const normalizedOpts: PressConferenceQuoteOption[] = (
            ['measured', 'assertive', 'critical'] as const
          ).map((stanceKey, optIdx) => {
            const matched =
              rawOpts.find((o: any) => String(o?.stance).toLowerCase() === stanceKey) ||
              rawOpts[optIdx];
            const cleanQuote = matched?.quote ? String(matched.quote).trim() : '';
            return {
              stance: stanceKey,
              quote:
                cleanQuote.length >= 20
                  ? cleanQuote.replace(/^["']|["']$/g, '')
                  : fallbackOpts[optIdx].quote,
              impactTag: IMPACT_TAG_BY_STANCE[stanceKey],
            };
          });

          return {
            id: `pc-${input.matchId}-${idx + 1}`,
            journalist: String(q.journalist || 'Senior Correspondent'),
            outlet: String(q.outlet || 'League Press Pool'),
            question: String(q.question || ''),
            targetPlayerId: typeof q.targetPlayerId === 'number' ? q.targetPlayerId : null,
            targetPlayerName: targetName,
            options: normalizedOpts,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Gemini press conference call failed on gemini-4-hydrogen:', (err as Error)?.message);
  }

  return buildFallbackQuestions(input);
}

/**
 * Generates press conference questions asynchronously in the background after match completion,
 * so the user is never blocked on a loading screen. Emits `match:press_ready` over WebSockets.
 */
export function scheduleBackgroundPressConference(leagueId: number, matchId: number) {
  setImmediate(async () => {
    try {
      const [matchRow] = await db
        .select()
        .from(matches)
        .where(and(eq(matches.id, matchId), eq(matches.leagueId, leagueId)))
        .limit(1);

      if (
        !matchRow ||
        !matchRow.resultSummaryJson ||
        matchRow.pressConferenceCompleted ||
        matchRow.pressConferenceJson?.questions?.length
      ) {
        return;
      }

      const leagueTeams = await db.select().from(teams).where(eq(teams.leagueId, leagueId));
      const humanTeam =
        leagueTeams.find(
          (t) => t.ownerUid && (t.id === matchRow.homeTeamId || t.id === matchRow.awayTeamId)
        ) || leagueTeams.find((t) => t.id === matchRow.homeTeamId);
      if (!humanTeam) return;

      const oppTeam =
        leagueTeams.find(
          (t) =>
            t.id === (humanTeam.id === matchRow.homeTeamId ? matchRow.awayTeamId : matchRow.homeTeamId)
        ) || leagueTeams[0];

      const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
      const [profile] = humanTeam.ownerUid
        ? await db
            .select()
            .from(managerProfiles)
            .where(eq(managerProfiles.userUid, humanTeam.ownerUid))
            .limit(1)
        : [null];

      const questions = await generatePressConferenceQuestions({
        matchId: matchRow.id,
        leagueName: league?.name || 'CM27 League',
        competitionLabel: matchRow.competitionLabel,
        humanTeamId: humanTeam.id,
        humanTeamName: humanTeam.name,
        humanTeamShortCode: humanTeam.shortCode,
        oppTeamName: oppTeam?.name || 'Opponent',
        oppTeamShortCode: oppTeam?.shortCode || 'OPP',
        managerName: profile?.managerName || 'Gaffer',
        summary: matchRow.resultSummaryJson,
      });

      const pcData: PressConferenceData = {
        questions,
        readyAt: new Date().toISOString(),
      };

      await db
        .update(matches)
        .set({ pressConferenceJson: pcData })
        .where(eq(matches.id, matchRow.id));

      wsHub.broadcastToLeague(leagueId, 'match:press_ready', {
        matchId: matchRow.id,
        teamShortCode: humanTeam.shortCode,
        headline: matchRow.marginText || 'Post-Match Press Conference Ready',
      });
    } catch (err) {
      console.error('Background press conference generation error:', err);
    }
  });
}

export function buildPressQuoteText(
  stance: 'measured' | 'assertive' | 'critical',
  managerName: string,
  teamShortCode: string,
  oppShortCode: string,
  targetPlayerName?: string | null,
  selectedQuote?: string | null
): string {
  if (selectedQuote && selectedQuote.trim().length > 10) {
    const clean = selectedQuote.trim().replace(/^["']|["']$/g, '');
    return `"${clean}" — ${managerName}`;
  }
  if (stance === 'measured') {
    return `"We stay level whether we win or lose. Every player in the ${teamShortCode} dressing room knows the process, and we take the lessons straight into training." — ${managerName}`;
  }
  if (stance === 'assertive') {
    return `"${teamShortCode} won't take a backward step against ${oppShortCode} or anyone in this competition. We back our match-winners to dominate the big moments." — ${managerName}`;
  }
  return targetPlayerName
    ? `"At this level there is no hiding place — ${targetPlayerName} and the senior group know those numbers aren't acceptable for ${teamShortCode}. Selection places have to be earned." — ${managerName}`
    : `"Standards slipped today and the dressing room knows it. If players don't execute under pressure for ${teamShortCode}, we will make tough selection calls." — ${managerName}`;
}
